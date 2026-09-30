import React, {
  FormEventHandler,
  KeyboardEventHandler,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  IRoomTimelineData,
  MatrixEvent,
  Preset,
  Room,
  RoomEvent,
  RoomMember,
  Visibility,
} from 'matrix-js-sdk';
import { EncryptedAttachmentInfo } from 'browser-encrypt-attachment';
import {
  Box,
  Button,
  Chip,
  Icon,
  IconSrc,
  Icons,
  Input,
  Spinner,
  Text,
  color,
  config,
  toRem,
} from 'folds';
import { atom, useAtom, useAtomValue, useSetAtom } from 'jotai';
import { useMatrixClient } from '../../hooks/useMatrixClient';
import { AsyncStatus, useAsyncCallback } from '../../hooks/useAsyncCallback';
import {
  decryptFile,
  downloadEncryptedMedia,
  encryptFile,
  isUserId,
  mxcUrlToHttp,
} from '../../utils/matrix';
import { useMediaAuthentication } from '../../hooks/useMediaAuthentication';
import { makeZip, readZip, ZipFile } from '../../utils/zip';
import { CodeBlock } from './CodeBlock';

// Must match angaara-runner's protocol.rs.
const RUNNER_ROOM_TYPE = 'io.angaara.runner';
// Rooms paired before the rename still count as runner rooms.
const LEGACY_RUNNER_ROOM_TYPE = 'io.hearth.runner';
const REQUEST_MSGTYPE = 'io.angaara.runner.request';
const REQUEST_KEY = 'io.angaara.runner.request';
const STATUS_KEY = 'io.angaara.runner.status';
const OUTPUT_KEY = 'io.angaara.runner.output';

type Action = 'ping' | 'check' | 'build' | 'test' | 'run' | 'stop' | 'shell' | 'save' | 'pull';
type RunnerInfo = {
  os: string;
  arch: string;
  cargo?: string;
  version: string;
  shell?: boolean;
  projects_dir?: string;
  tunnel?: string;
  busy?: boolean;
  projects?: string[];
};
type RunnerStatus = {
  job_id: string;
  state: 'online' | 'running' | 'succeeded' | 'failed' | 'stopped' | 'rejected';
  exit_code?: number;
  reason?: string;
  info?: RunnerInfo;
  bundle?: EncryptedAttachmentInfo & { url: string };
};
type TerminalLine = { key: string; text: string; tone?: 'ok' | 'bad' | 'info' };

const CARGO_ACTIONS: Action[] = ['check', 'build', 'test', 'run'];
const ACTION_ICONS: Record<string, IconSrc> = {
  check: Icons.Check,
  build: Icons.Setting,
  test: Icons.Flag,
  run: Icons.Play,
};
const SHELL_TOOLS = [
  'cargo fmt',
  'cargo clippy',
  'cargo update',
  'cargo tree',
  'cargo doc',
  'cargo clean',
  'git status',
  'ls',
];

const newJobId = () =>
  Array.from(crypto.getRandomValues(new Uint8Array(12)), (b) =>
    b.toString(16).padStart(2, '0')
  ).join('');

const getRunnerId = (room: Room, me: string): string | undefined =>
  room
    .getMembers()
    .filter((m: RoomMember) => m.membership === 'join' || m.membership === 'invite')
    .find((m: RoomMember) => m.userId !== me)?.userId;

// Refuse to send anything unless the room is encrypted and only we and the runner are in it.
const roomIsPrivate = (room: Room, me: string, runnerId: string): boolean =>
  room.hasEncryptionStateEvent() &&
  room
    .getMembers()
    .filter((m: RoomMember) => ['join', 'invite', 'knock'].includes(m.membership ?? ''))
    .every((m: RoomMember) => m.userId === me || m.userId === runnerId);

// Kept outside the component so the runner session survives switching channels.
const infoByRoomAtom = atom<Record<string, RunnerInfo>>({});
const linesAtom = atom<TerminalLine[]>([]);
const busyAtom = atom(false);
const uploadAtom = atom(true);
const MAX_LINES = 2000;
const sentJobs = new Set<string>();
const seenEvents = new Set<string>();
const pingedRooms = new Set<string>();
const answeredJobs = new Set<string>();
// A runner that never replies (offline, or an older protocol) shouldn't leave the panel stuck.
const REPLY_TIMEOUT_MS = 20000;
const shellHistory = { items: [] as string[], index: 0 };

type SaveState = 'idle' | 'saving' | 'saved' | 'failed';
export const saveStateAtom = atom<SaveState>('idle');
export const savedFilesAtom = atom<ZipFile[] | undefined>(undefined);
type RunnerBridge = {
  save?: () => void;
  pull?: (project: string) => Promise<ZipFile[]>;
  projects?: string[];
  vscodeUrl?: string;
  act?: (action: Action) => void;
  shell?: (command: string) => void;
  sending?: boolean;
  runnerLabel?: string;
};
const bridgeAtom = atom<RunnerBridge>({});
export const useRunnerBridge = () => useAtomValue(bridgeAtom);
const pullWaiters = new Map<
  string,
  { project: string; resolve: (files: ZipFile[]) => void; reject: (e: Error) => void }
>();
const PULL_TIMEOUT_MS = 60000;
const uploadedFiles = new Map<string, ZipFile[]>();
const saveJobs = new Set<string>();
// The build cache and the bot's login stay on the runner; never upload them.
const NO_UPLOAD = ['target/', 'bot-data/'];

const toUriPath = (path: string): string =>
  encodeURI(`/${path.replace(/\\/g, '/').replace(/^\/+/, '')}`)
    .replace(/#/g, '%23')
    .replace(/\?/g, '%3F');

const TERM_BG = '#0a0a0b';
const TERM_FG = '#d4d4d4';
const TERM_LINE = '1px solid #262629';
const MONO = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';

function StatusDot({ tone, glow }: { tone: string; glow?: boolean }) {
  return (
    <span
      aria-hidden
      style={{
        width: toRem(8),
        height: toRem(8),
        flexShrink: 0,
        borderRadius: '50%',
        background: tone,
        boxShadow: glow ? `0 0 6px ${tone}` : undefined,
      }}
    />
  );
}

function Terminal({ lines }: { lines: TerminalLine[] }) {
  const boxRef = useRef<HTMLDivElement>(null);
  // Scroll only the terminal box; scrollIntoView would also yank the page to it.
  useEffect(() => {
    const box = boxRef.current;
    if (box) box.scrollTop = box.scrollHeight;
  }, [lines]);
  const toneColor = { ok: color.Success.Main, bad: color.Critical.Main, info: color.Primary.Main };
  return (
    <Box
      ref={boxRef}
      direction="Column"
      grow="Yes"
      style={{
        minHeight: 0,
        overflowY: 'auto',
        padding: `${config.space.S200} ${config.space.S300}`,
        fontFamily: MONO,
        fontSize: '0.8rem',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
      }}
    >
      {lines.length === 0 && (
        <span style={{ opacity: 0.5 }}>
          $ waiting for a job... (no keyboard input, so interactive programs like vim won&apos;t
          work)
        </span>
      )}
      {lines.map((line) => (
        <span key={line.key} style={{ color: line.tone ? toneColor[line.tone] : TERM_FG }}>
          {line.text}
        </span>
      ))}
    </Box>
  );
}

function TermButton({
  label,
  icon,
  tint,
  disabled,
  onClick,
}: {
  label: string;
  icon?: IconSrc;
  tint?: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: toRem(4),
        flexShrink: 0,
        padding: `${toRem(2)} ${toRem(8)}`,
        borderRadius: config.radii.R300,
        border: TERM_LINE,
        background: 'transparent',
        color: tint ?? TERM_FG,
        fontFamily: MONO,
        fontSize: '0.75rem',
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.4 : 1,
      }}
    >
      {icon && <Icon size="50" src={icon} />}
      {label}
    </button>
  );
}

export function RunnerTerminal() {
  const { act, shell, sending, runnerLabel } = useAtomValue(bridgeAtom);
  const [lines, setLines] = useAtom(linesAtom);
  const busy = useAtomValue(busyAtom);
  const online = !!act;
  const idle = !busy && !sending;

  const handleShellKey: KeyboardEventHandler<HTMLInputElement> = (evt) => {
    const input = evt.currentTarget;
    const history = shellHistory;
    if (evt.key === 'Enter') {
      evt.preventDefault();
      shell?.(input.value);
      input.value = '';
    } else if (evt.key === 'ArrowUp' || evt.key === 'ArrowDown') {
      if (history.items.length === 0) return;
      evt.preventDefault();
      const step = evt.key === 'ArrowUp' ? -1 : 1;
      history.index = Math.min(Math.max(history.index + step, 0), history.items.length);
      input.value = history.items[history.index] ?? '';
    }
  };

  let placeholder = 'Connect a runner below to use the shell';
  if (online) {
    placeholder = shell
      ? 'Run a command in the project folder, e.g. cargo add serde'
      : 'Shell is off. Restart the runner with ANGAARA_RUNNER_ALLOW_SHELL=1';
  }

  return (
    <Box
      direction="Column"
      grow="Yes"
      style={{ minHeight: 0, background: TERM_BG, color: TERM_FG }}
    >
      <Box
        alignItems="Center"
        gap="200"
        shrink="No"
        style={{ padding: `0 ${config.space.S200}`, borderBottom: TERM_LINE }}
      >
        <span
          style={{
            padding: `${config.space.S200} ${config.space.S100}`,
            borderBottom: `2px solid ${color.Primary.Main}`,
            fontSize: '0.7rem',
            fontWeight: 600,
            letterSpacing: '0.08em',
          }}
        >
          TERMINAL
        </span>
        <Box alignItems="Center" gap="100" shrink="No" title={runnerLabel}>
          <StatusDot tone={online ? color.Success.Main : color.Critical.Main} glow={online} />
          <span style={{ fontFamily: MONO, fontSize: '0.75rem', opacity: 0.7 }}>
            {online ? runnerLabel : 'offline'}
          </span>
        </Box>
        <Box gap="100" grow="Yes" style={{ overflowX: 'auto', minWidth: 0 }}>
          {SHELL_TOOLS.map((tool) => (
            <TermButton
              key={tool}
              label={tool}
              disabled={!shell || !idle}
              onClick={() => shell?.(tool)}
            />
          ))}
        </Box>
        <TermButton
          label="Run"
          icon={Icons.Play}
          tint={color.Success.Main}
          disabled={!online || !idle}
          onClick={() => act?.('run')}
        />
        <TermButton
          label="Stop"
          icon={Icons.Power}
          tint={color.Critical.Main}
          disabled={!online}
          onClick={() => act?.('stop')}
        />
        <TermButton label="Clear" onClick={() => setLines([])} />
      </Box>
      <Terminal lines={lines} />
      <Box
        alignItems="Center"
        gap="200"
        shrink="No"
        style={{ padding: `0 ${config.space.S300}`, borderTop: TERM_LINE, fontFamily: MONO }}
      >
        <span style={{ color: color.Primary.Main }}>$</span>
        <input
          onKeyDown={handleShellKey}
          disabled={!shell}
          aria-label="Shell command"
          spellCheck={false}
          placeholder={placeholder}
          style={{
            flexGrow: 1,
            padding: `${config.space.S200} 0`,
            background: 'transparent',
            border: 'none',
            outline: 'none',
            color: TERM_FG,
            fontFamily: 'inherit',
            fontSize: '0.8rem',
          }}
        />
      </Box>
    </Box>
  );
}

export function RunnerStatusItem() {
  const { act } = useAtomValue(bridgeAtom);
  const busy = useAtomValue(busyAtom);
  let tone = color.Critical.Main;
  let text = 'Runner offline';
  if (act) {
    tone = busy ? color.Warning.Main : color.Success.Main;
    text = busy ? 'Running' : 'Runner online';
  }
  return (
    <Box alignItems="Center" gap="100" shrink="No">
      <StatusDot tone={tone} glow={!!act} />
      <Text size="T200" priority="300">
        {text}
      </Text>
    </Box>
  );
}

const statusLine = (s: RunnerStatus): TerminalLine => {
  const key = `${s.job_id}-status-${s.state}-${Math.random()}`;
  const reason = s.reason ? `: ${s.reason}` : '';
  switch (s.state) {
    case 'online':
      return {
        key,
        tone: 'ok',
        text: `runner online (${s.info?.os}/${s.info?.arch}, ${
          s.info?.cargo ?? 'cargo missing'
        }, shell ${s.info?.shell ? 'on' : 'off'})`,
      };
    case 'running':
      return { key, tone: 'info', text: 'running...' };
    case 'succeeded':
      return { key, tone: 'ok', text: 'finished successfully' };
    case 'stopped':
      return { key, tone: 'info', text: 'stopped' };
    case 'rejected':
      return { key, tone: 'bad', text: `rejected${reason}` };
    default:
      return {
        key,
        tone: 'bad',
        text: `failed${reason || (s.exit_code !== undefined ? ` (exit code ${s.exit_code})` : '')}`,
      };
  }
};

const projectPathOf = (info: RunnerInfo | undefined, projectRoot: string) =>
  info?.projects_dir && `${info.projects_dir}${info.os === 'windows' ? '\\' : '/'}${projectRoot}`;

const tunnelUrlOf = (info: RunnerInfo | undefined, projectRoot: string) => {
  const projectPath = projectPathOf(info, projectRoot);
  if (!projectPath || !info?.tunnel || !/^[\w-]+$/.test(info.tunnel)) return undefined;
  return `https://vscode.dev/tunnel/${info.tunnel}${toUriPath(projectPath)}`;
};

function VsCodeSection({ info, projectRoot }: { info?: RunnerInfo; projectRoot: string }) {
  const [sshHost, setSshHost] = useState('');
  const [tunnelName, setTunnelName] = useState('');
  const projectPath = projectPathOf(info, projectRoot);
  const uriPath = projectPath ? toUriPath(projectPath) : undefined;
  // Only plain host and tunnel names go into the links.
  const sshOk = !!uriPath && /^[\w.@:-]+$/.test(sshHost);
  const tunnelOk = !!uriPath && /^[\w-]+$/.test(tunnelName);
  const runnerTunnel = info?.tunnel && /^[\w-]+$/.test(info.tunnel) ? info.tunnel : undefined;

  return (
    <Box
      direction="Column"
      gap="200"
      style={{
        padding: config.space.S300,
        borderRadius: config.radii.R400,
        background: color.Background.Container,
      }}
    >
      <Text size="L400">VS Code</Text>
      <Text size="T200" priority="300" style={{ wordBreak: 'break-all' }}>
        Project on the runner: <code>{projectPath || 'connect a runner to see it'}</code>
      </Text>
      {runnerTunnel && uriPath && (
        <Box gap="200" alignItems="Center" wrap="Wrap">
          <Button
            as="a"
            href={tunnelUrlOf(info, projectRoot)}
            target="_blank"
            rel="noreferrer noopener"
            size="300"
            variant="Primary"
            fill="Solid"
            radii="300"
            before={<Icon size="100" src={Icons.Code} />}
          >
            <Text size="B300">Open in VS Code</Text>
          </Button>
          <Text size="T200" priority="300">
            Through the runner&apos;s tunnel <code>{runnerTunnel}</code>, from any computer.
          </Text>
        </Box>
      )}
      <Box gap="200" alignItems="Center" wrap="Wrap">
        <Button
          as="a"
          href={uriPath && `vscode://file${uriPath}`}
          size="300"
          variant={runnerTunnel ? 'Secondary' : 'Primary'}
          fill="Soft"
          radii="300"
          before={<Icon size="100" src={Icons.Code} />}
        >
          <Text size="B300">{runnerTunnel ? 'Open Locally' : 'Open in VS Code'}</Text>
        </Button>
        <Text size="T200" priority="300">
          When the runner is on this computer.
        </Text>
      </Box>
      <Box gap="200" alignItems="Center" wrap="Wrap">
        <Input
          value={sshHost}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSshHost(e.target.value.trim())}
          size="300"
          variant="Secondary"
          radii="300"
          placeholder="SSH host, e.g. me@my-vps"
          style={{ minWidth: toRem(180) }}
        />
        <Button
          as="a"
          href={sshOk ? `vscode://vscode-remote/ssh-remote+${sshHost}${uriPath}` : undefined}
          aria-disabled={!sshOk}
          size="300"
          variant="Secondary"
          fill="Soft"
          radii="300"
          style={sshOk ? undefined : { pointerEvents: 'none', opacity: 0.5 }}
        >
          <Text size="B300">Open over SSH</Text>
        </Button>
      </Box>
      <Text size="T200" priority="300">
        Needs the Remote - SSH extension in VS Code and SSH access to the runner machine.
      </Text>
      <Box gap="200" alignItems="Center" wrap="Wrap">
        <Input
          value={tunnelName}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
            setTunnelName(e.target.value.trim())
          }
          size="300"
          variant="Secondary"
          radii="300"
          placeholder="Tunnel name, e.g. my-runner"
          style={{ minWidth: toRem(180) }}
        />
        <Button
          as="a"
          href={tunnelOk ? `https://vscode.dev/tunnel/${tunnelName}${uriPath}` : undefined}
          target="_blank"
          rel="noreferrer noopener"
          aria-disabled={!tunnelOk}
          size="300"
          variant="Secondary"
          fill="Soft"
          radii="300"
          style={tunnelOk ? undefined : { pointerEvents: 'none', opacity: 0.5 }}
        >
          <Text size="B300">Open Tunnel</Text>
        </Button>
      </Box>
      <Text size="T200" priority="300">
        No SSH? Install VS Code on the runner machine and start a tunnel there once. It works behind
        firewalls, like the runner:
      </Text>
      <CodeBlock code={`code tunnel --name ${tunnelOk ? tunnelName : 'my-runner'}`} />
      <Text size="T200" style={{ color: color.Warning.Main }}>
        Edited files in VS Code? Turn off &quot;Upload from Angaara&quot; above, or the next Save or
        build replaces the runner&apos;s copy with the files from this page.
      </Text>
    </Box>
  );
}

type RunnerPanelProps = {
  files: ZipFile[];
  projectRoot: string;
};
export function RunnerPanel({ files, projectRoot }: RunnerPanelProps) {
  const mx = useMatrixClient();
  const me = mx.getSafeUserId();
  const [refresh, setRefresh] = useState(0);
  const runnerRooms = useMemo(
    () =>
      mx
        .getRooms()
        .filter(
          (r: Room) =>
            r.getMyMembership() === 'join' &&
            [RUNNER_ROOM_TYPE, LEGACY_RUNNER_ROOM_TYPE].includes(r.getType() ?? '')
        ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mx, refresh]
  );
  const [roomId, setRoomId] = useState<string>();
  const room = runnerRooms.find((r: Room) => r.roomId === roomId) ?? runnerRooms[0];
  const runnerId = room ? getRunnerId(room, me) : undefined;

  const setLinesRaw = useSetAtom(linesAtom);
  const [busy, setBusy] = useAtom(busyAtom);
  const [upload, setUpload] = useAtom(uploadAtom);
  const [infoByRoom, setInfoByRoom] = useAtom(infoByRoomAtom);
  const useAuthentication = useMediaAuthentication();
  const setSaveState = useSetAtom(saveStateAtom);
  const setSavedFiles = useSetAtom(savedFilesAtom);
  const setBridge = useSetAtom(bridgeAtom);
  const info = room ? infoByRoom[room.roomId] : undefined;
  const setLines = useCallback(
    (update: (l: TerminalLine[]) => TerminalLine[]) =>
      setLinesRaw((l) => update(l).slice(-MAX_LINES)),
    [setLinesRaw]
  );

  // Only encrypted updates from the paired runner account count; everything else is ignored.
  useEffect(() => {
    if (!room || !runnerId) return undefined;
    const handle = async (ev: MatrixEvent) => {
      if (ev.getRoomId() !== room.roomId || ev.getSender() !== runnerId || !ev.isEncrypted())
        return;
      const eventId = ev.getId();
      if (!eventId || seenEvents.has(eventId)) return;
      seenEvents.add(eventId);
      await mx.decryptEventIfNeeded(ev);
      if (ev.isDecryptionFailure()) return;
      const content = ev.getContent();
      const status = content[STATUS_KEY] as RunnerStatus | undefined;
      const output = content[OUTPUT_KEY] as
        | { job_id: string; text: string; seq: number }
        | undefined;
      const waiter = status && pullWaiters.get(status.job_id);
      if (status && waiter) {
        answeredJobs.add(status.job_id);
        pullWaiters.delete(status.job_id);
        const { bundle } = status;
        if (status.state !== 'succeeded' || !bundle?.url?.startsWith('mxc://')) {
          waiter.reject(new Error(status.reason ?? 'The runner could not send the project.'));
          return;
        }
        try {
          const mediaUrl = mxcUrlToHttp(mx, bundle.url, useAuthentication);
          if (!mediaUrl) throw new Error('Invalid project download');
          const zip = await downloadEncryptedMedia(mediaUrl, (buf) =>
            decryptFile(buf, 'application/zip', bundle)
          );
          const unzipped = readZip(await zip.arrayBuffer());
          waiter.resolve(unzipped.map((f) => ({ ...f, path: `${waiter.project}/${f.path}` })));
        } catch (e) {
          waiter.reject(e instanceof Error ? e : new Error('Could not open the project.'));
        }
      } else if (status && saveJobs.has(status.job_id)) {
        // Saves don't touch busy, so they work while a bot is running.
        answeredJobs.add(status.job_id);
        const saved = uploadedFiles.get(status.job_id);
        uploadedFiles.delete(status.job_id);
        if (status.state === 'succeeded') {
          setSaveState('saved');
          setSavedFiles(saved);
        } else {
          setSaveState('failed');
          setLines((l) => [
            ...l,
            { ...statusLine(status), text: `save ${statusLine(status).text}` },
          ]);
        }
      } else if (status && sentJobs.has(status.job_id)) {
        answeredJobs.add(status.job_id);
        const uploaded = uploadedFiles.get(status.job_id);
        if (uploaded && status.state === 'running') {
          uploadedFiles.delete(status.job_id);
          setSaveState('saved');
          setSavedFiles(uploaded);
        }
        setLines((l) => [...l, statusLine(status)]);
        if (status.state === 'online' && status.info) {
          const runnerInfo = status.info;
          setInfoByRoom((m) => ({ ...m, [room.roomId]: runnerInfo }));
          // After a reload the page forgets a running job; the runner remembers.
          if (runnerInfo.busy !== undefined) setBusy(runnerInfo.busy);
        } else if (status.state !== 'running') {
          setBusy(false);
        }
      } else if (output && sentJobs.has(output.job_id) && typeof output.text === 'string') {
        answeredJobs.add(output.job_id);
        setLines((l) => [...l, { key: `${output.job_id}-${output.seq}`, text: output.text }]);
      }
    };
    const onTimeline = (
      ev: MatrixEvent,
      r: Room | undefined,
      toStart: boolean | undefined,
      removed: boolean,
      data: IRoomTimelineData
    ) => {
      if (data.liveEvent && !toStart && !removed) handle(ev);
    };
    room.getLiveTimeline().getEvents().forEach(handle);
    mx.on(RoomEvent.Timeline, onTimeline);
    return () => {
      mx.removeListener(RoomEvent.Timeline, onTimeline);
    };
  }, [
    mx,
    room,
    runnerId,
    useAuthentication,
    setLines,
    setBusy,
    setInfoByRoom,
    setSaveState,
    setSavedFiles,
  ]);

  const [sendState, send] = useAsyncCallback(
    useCallback(
      async (action: Action, command?: string) => {
        if (!room || !runnerId) throw new Error('No runner selected');
        if (!roomIsPrivate(room, me, runnerId)) {
          throw new Error('Runner room must be encrypted and contain only you and the runner');
        }
        const jobId = newJobId();
        sentJobs.add(jobId);
        const saving = action === 'save';
        if (saving) {
          saveJobs.add(jobId);
          setSaveState('saving');
        }

        const request: Record<string, unknown> = { job_id: jobId, action, project: projectRoot };
        if (action === 'shell') request.command = command;
        if (saving || (upload && CARGO_ACTIONS.includes(action))) {
          const prefix = `${projectRoot}/`;
          const zip = makeZip(
            files
              .filter((f) => f.path.startsWith(prefix))
              .map((f) => ({ path: f.path.slice(prefix.length), content: f.content }))
              .filter((f) => !NO_UPLOAD.some((dir) => f.path.startsWith(dir)))
          );
          uploadedFiles.set(jobId, files);
          // The project (including .env) is encrypted before upload; only the runner can read it.
          const { encInfo, file } = await encryptFile(
            new File([zip], 'project.zip', { type: 'application/zip' })
          );
          const uploaded = await mx.uploadContent(file, {
            type: 'application/octet-stream',
            includeFilename: false,
          });
          request.bundle = { url: uploaded.content_uri, ...encInfo };
        }
        if (action !== 'ping' && action !== 'stop' && !saving) {
          setBusy(true);
          const shown = action === 'shell' ? command : `cargo ${action}`;
          setLines((l) => [...l, { key: `${jobId}-cmd`, tone: 'info', text: `$ ${shown}` }]);
        }
        await mx.sendEvent(room.roomId, 'm.room.message' as any, {
          msgtype: REQUEST_MSGTYPE,
          body: `${action} ${projectRoot}`,
          [REQUEST_KEY]: request,
        });
        window.setTimeout(() => {
          if (answeredJobs.has(jobId)) return;
          uploadedFiles.delete(jobId);
          if (saving) setSaveState('failed');
          else setBusy(false);
          setLines((l) => [
            ...l,
            {
              key: `${jobId}-noreply`,
              tone: 'bad',
              text: `no reply to ${action}: the runner may be offline or on an older version`,
            },
          ]);
        }, REPLY_TIMEOUT_MS);
      },
      [mx, me, room, runnerId, files, projectRoot, upload, setBusy, setLines, setSaveState]
    )
  );
  const failSave = useCallback(() => setSaveState('failed'), [setSaveState]);

  const pull = useCallback(
    async (project: string): Promise<ZipFile[]> => {
      if (!room || !runnerId) throw new Error('No runner connected');
      if (!roomIsPrivate(room, me, runnerId)) {
        throw new Error('Runner room must be encrypted and contain only you and the runner');
      }
      const jobId = newJobId();
      sentJobs.add(jobId);
      const result = new Promise<ZipFile[]>((resolve, reject) => {
        pullWaiters.set(jobId, { project, resolve, reject });
        window.setTimeout(() => {
          if (!pullWaiters.delete(jobId)) return;
          reject(new Error('The runner did not answer. It may be offline or on an older version.'));
        }, PULL_TIMEOUT_MS);
      });
      await mx.sendEvent(room.roomId, 'm.room.message' as any, {
        msgtype: REQUEST_MSGTYPE,
        body: `pull ${project}`,
        [REQUEST_KEY]: { job_id: jobId, action: 'pull', project },
      });
      return result;
    },
    [mx, me, room, runnerId]
  );

  const [pairState, pair] = useAsyncCallback(
    useCallback(
      async (runner: string) => {
        await mx.createRoom({
          name: 'Angaara Runner',
          preset: Preset.PrivateChat,
          visibility: Visibility.Private,
          invite: [runner],
          creation_content: { type: RUNNER_ROOM_TYPE },
          initial_state: [
            {
              type: 'm.room.encryption',
              state_key: '',
              content: { algorithm: 'm.megolm.v1.aes-sha2' },
            },
            {
              type: 'm.room.history_visibility',
              state_key: '',
              content: { history_visibility: 'joined' },
            },
            { type: 'm.room.guest_access', state_key: '', content: { guest_access: 'forbidden' } },
          ],
        });
      },
      [mx]
    )
  );

  const [unpairState, unpair] = useAsyncCallback(
    useCallback(
      async (roomToLeave: Room) => {
        await mx.leave(roomToLeave.roomId);
        await mx.forget(roomToLeave.roomId).catch(() => undefined);
        setInfoByRoom((m) => {
          const next = { ...m };
          delete next[roomToLeave.roomId];
          return next;
        });
        pingedRooms.delete(roomToLeave.roomId);
        setBusy(false);
        setRoomId(undefined);
        setRefresh((n) => n + 1);
      },
      [mx, setInfoByRoom, setBusy]
    )
  );

  const handleUnpair = () => {
    if (!room) return;
    const name = runnerId ?? room.name;
    // Leaving the private room is what unpairs; the runner can't act without it.
    if (!window.confirm(`Unpair ${name}? You can pair it again later.`)) return;
    unpair(room).catch(() => undefined);
  };

  const handlePair: FormEventHandler<HTMLFormElement> = (evt) => {
    evt.preventDefault();
    const input = (evt.target as HTMLFormElement).runnerIdInput as HTMLInputElement;
    const runner = input.value.trim();
    if (!isUserId(runner) || runner === me) return;
    pair(runner).then(() => {
      input.value = '';
      window.setTimeout(() => setRefresh((n) => n + 1), 1000);
    });
  };

  // After a page reload the runner is unknown again, so say hello once per room.
  useEffect(() => {
    if (!room || !runnerId || info || pingedRooms.has(room.roomId)) return;
    pingedRooms.add(room.roomId);
    send('ping').catch(() => undefined);
  }, [room, runnerId, info, send]);

  const sending = sendState.status === AsyncStatus.Loading;
  const locked = !info;
  const shellOn = !!info?.shell;

  const save = useMemo(
    () => (locked ? undefined : () => send('save').catch(failSave)),
    [locked, send, failSave]
  );
  const vscodeUrl = tunnelUrlOf(info, projectRoot);
  const projects = info?.projects;

  const runShell = useCallback(
    (command: string) => {
      const trimmed = command.trim();
      if (!trimmed || busy || sending) return;
      const history = shellHistory;
      history.items = [...history.items.filter((c) => c !== trimmed), trimmed].slice(-50);
      history.index = history.items.length;
      send('shell', trimmed);
    },
    [busy, sending, send]
  );
  const act = useMemo(
    () =>
      locked
        ? undefined
        : (action: Action) => {
            send(action);
          },
    [locked, send]
  );
  const shell = locked || !shellOn ? undefined : runShell;
  const runnerLabel = info && `${runnerId ?? 'runner'} · ${info.os}/${info.arch}`;
  useEffect(() => {
    setBridge({
      save,
      vscodeUrl,
      projects,
      pull: locked ? undefined : pull,
      act,
      shell,
      sending,
      runnerLabel,
    });
    return () => setBridge({});
  }, [save, vscodeUrl, projects, locked, pull, act, shell, sending, runnerLabel, setBridge]);

  useEffect(() => {
    const onKey = (evt: KeyboardEvent) => {
      if (!(evt.ctrlKey || evt.metaKey) || evt.altKey || evt.key.toLowerCase() !== 's') return;
      evt.preventDefault();
      if (save) save();
      else
        setLines((l) => [
          ...l,
          { key: `save-${Date.now()}`, tone: 'bad', text: 'connect a runner to save' },
        ]);
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [save, setLines]);

  return (
    <Box direction="Column" gap="300">
      <Box as="form" onSubmit={handlePair} gap="200" alignItems="Center">
        <Box grow="Yes" direction="Column">
          <Input
            name="runnerIdInput"
            size="300"
            variant="Secondary"
            radii="300"
            placeholder="Runner account, e.g. @my-runner:matrix.org"
          />
        </Box>
        <Button
          type="submit"
          size="300"
          variant="Secondary"
          fill="Soft"
          radii="300"
          disabled={pairState.status === AsyncStatus.Loading}
        >
          <Text size="B300">Pair Runner</Text>
        </Button>
      </Box>
      {pairState.status === AsyncStatus.Error && (
        <Text size="T200" style={{ color: color.Critical.Main }}>
          Couldn&apos;t create the runner room.
        </Text>
      )}

      {runnerRooms.length === 0 ? (
        <Text size="T300" priority="300">
          No runners yet. Start angaara-runner on your machine, then pair it here.
        </Text>
      ) : (
        <Box gap="200" alignItems="Center" wrap="Wrap">
          <select
            value={room?.roomId}
            onChange={(e) => setRoomId(e.target.value)}
            aria-label="Runner"
            style={{
              padding: config.space.S200,
              borderRadius: config.radii.R300,
              background: color.Secondary.Container,
              color: color.Secondary.OnContainer,
              border: `1px solid ${color.Secondary.ContainerLine}`,
            }}
          >
            {runnerRooms.map((r: Room) => (
              <option key={r.roomId} value={r.roomId}>
                {getRunnerId(r, me) ?? r.name}
              </option>
            ))}
          </select>
          <Button
            size="300"
            variant={info ? 'Secondary' : 'Primary'}
            fill={info ? 'None' : 'Solid'}
            radii="300"
            disabled={sending}
            onClick={() => send('ping')}
          >
            <Text size="B300">{info ? 'Ping' : 'Connect'}</Text>
          </Button>
          <Button
            size="300"
            variant="Critical"
            fill="None"
            radii="300"
            disabled={unpairState.status === AsyncStatus.Loading}
            onClick={handleUnpair}
          >
            <Text size="B300">Unpair</Text>
          </Button>
          {sending && <Spinner size="200" variant="Secondary" />}
          <Box grow="Yes" />
          <Box
            alignItems="Center"
            gap="200"
            style={{
              padding: `${config.space.S100} ${config.space.S300}`,
              borderRadius: config.radii.Pill,
              background: color.Background.Container,
            }}
          >
            <StatusDot tone={info ? color.Success.Main : color.Critical.Main} glow={!!info} />
            <Text size="T200" style={{ fontFamily: MONO }}>
              {info
                ? `online · ${info.os}/${info.arch} · ${info.cargo ?? 'cargo missing'}`
                : 'offline'}
            </Text>
          </Box>
        </Box>
      )}
      {unpairState.status === AsyncStatus.Error && (
        <Text size="T200" style={{ color: color.Critical.Main }}>
          Couldn&apos;t unpair. Try again.
        </Text>
      )}
      {sendState.status === AsyncStatus.Error && (
        <Text size="T200" style={{ color: color.Critical.Main }}>
          {sendState.error instanceof Error ? sendState.error.message : 'Could not send job.'}
        </Text>
      )}

      {locked && (
        <Box
          alignItems="Center"
          gap="300"
          style={{
            padding: config.space.S300,
            borderRadius: config.radii.R400,
            background: color.Background.Container,
            border: `1px dashed ${color.Secondary.ContainerLine}`,
          }}
        >
          <Icon size="400" src={Icons.Lock} />
          <Box direction="Column" gap="100">
            <Text size="H6">Locked until your runner connects</Text>
            <Text size="T200" priority="300">
              {runnerRooms.length === 0
                ? 'Start angaara-runner on your machine and pair it above.'
                : 'Start angaara-runner on your machine, then hit Connect.'}{' '}
              Build, VS Code and the terminal under the editor unlock once it answers.
            </Text>
          </Box>
        </Box>
      )}

      <Box
        direction="Column"
        gap="300"
        aria-disabled={locked}
        style={locked ? { opacity: 0.45, pointerEvents: 'none', userSelect: 'none' } : undefined}
      >
        <Text size="L400">Build</Text>
        <Box gap="200" wrap="Wrap" alignItems="Center">
          <Button
            size="300"
            variant="Secondary"
            fill="Soft"
            radii="300"
            disabled={locked || sending}
            onClick={() => save?.()}
            title="Save to runner (Ctrl+S)"
            before={<Icon size="100" src={Icons.Send} />}
          >
            <Text size="B300">Save</Text>
          </Button>
          {CARGO_ACTIONS.map((action) => (
            <Button
              key={action}
              size="300"
              variant={action === 'run' ? 'Primary' : 'Secondary'}
              fill={action === 'run' ? 'Solid' : 'Soft'}
              radii="300"
              disabled={locked || busy || sending}
              onClick={() => send(action)}
              before={<Icon size="100" src={ACTION_ICONS[action]} />}
            >
              <Text size="B300">{action[0].toUpperCase() + action.slice(1)}</Text>
            </Button>
          ))}
          <Button
            size="300"
            variant="Critical"
            fill="Soft"
            radii="300"
            disabled={locked}
            onClick={() => send('stop')}
            before={<Icon size="100" src={Icons.Power} />}
          >
            <Text size="B300">Stop</Text>
          </Button>
          <Box as="label" gap="100" alignItems="Center">
            <input
              type="checkbox"
              checked={upload}
              disabled={locked}
              onChange={(e) => setUpload(e.target.checked)}
            />
            <Text size="T200">Upload from Angaara</Text>
          </Box>
        </Box>
        <Text size="T200" priority="300">
          {upload
            ? 'Save (Ctrl+S) and builds send the files from the editor above and replace the runner copy (target/ and bot-data/ stay).'
            : "Builds use the runner's own files, for example after editing them in VS Code."}
        </Text>

        <VsCodeSection info={info} projectRoot={projectRoot} />
      </Box>
    </Box>
  );
}

export function RunnerEditorActions({ files }: { files: ZipFile[] }) {
  const { save, vscodeUrl } = useAtomValue(bridgeAtom);
  const saveState = useAtomValue(saveStateAtom);
  const savedFiles = useAtomValue(savedFilesAtom);
  const dirty = savedFiles !== files;
  const saving = saveState === 'saving';

  let label = 'Save';
  if (saving) label = 'Saving';
  else if (saveState === 'failed') label = 'Save failed, retry';
  else if (!dirty) label = 'Saved';

  return (
    <>
      <Chip
        variant={dirty && save ? 'Primary' : 'SurfaceVariant'}
        radii="Pill"
        disabled={!save || saving}
        onClick={() => save?.()}
        title={save ? 'Save to runner (Ctrl+S)' : 'Connect a runner below to save'}
        before={
          saving ? (
            <Spinner size="50" variant="Secondary" />
          ) : (
            <Icon size="50" src={dirty ? Icons.Send : Icons.Check} />
          )
        }
      >
        <Text size="B300">{label}</Text>
      </Chip>
      {vscodeUrl && (
        <Chip
          as="a"
          href={vscodeUrl}
          target="_blank"
          rel="noreferrer noopener"
          variant="SurfaceVariant"
          radii="Pill"
          before={<Icon size="50" src={Icons.Code} />}
        >
          <Text size="B300">Open in VS Code</Text>
        </Chip>
      )}
    </>
  );
}

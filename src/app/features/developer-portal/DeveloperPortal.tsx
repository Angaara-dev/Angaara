import React, {
  ChangeEvent,
  FormEventHandler,
  ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useAtom, useAtomValue } from 'jotai';
import { createClient, IIdentityProvider, MatrixEvent, Room, SSOAction } from 'matrix-js-sdk';
import { ISSOFlow } from 'matrix-js-sdk/lib/@types/auth';
import {
  Avatar,
  AvatarImage,
  Box,
  Button,
  Chip,
  Icon,
  Icons,
  Input,
  Spinner,
  Text,
  color,
  config,
} from 'folds';
import { siApple, siGithub, siGitlab, siGoogle, SimpleIcon } from 'simple-icons';
import { SequenceCard } from '../../components/sequence-card';
import { SettingTile } from '../../components/setting-tile';
import { PasswordInput } from '../../components/password-input';
import { SequenceCardStyle } from '../settings/styles.css';
import { CodeBlock, CopyChip } from './CodeBlock';
import { ProjectExplorer } from './ProjectExplorer';
import { STARTER_ROOT } from './starterProject';
import { STARTER_WORKSPACE, Workspace, workspaceAtom } from './workspace';
import {
  RunnerEditorActions,
  RunnerPanel,
  RunnerStatusItem,
  RunnerTerminal,
  savedFilesAtom,
} from './RunnerPanel';
import { ProjectSync } from './ProjectSync';
import { GitHubCommitPanel, GitHubEditorActions, GitHubLinkBar } from './github/GitHubPanels';
import {
  DroppedItems,
  PickedFile,
  describeSkipped,
  pickedFromEntries,
  pickedFromInput,
  readPicked,
} from './importFolder';
import { ZipFile } from '../../utils/zip';
import { useMatrixClient } from '../../hooks/useMatrixClient';
import { AsyncStatus, useAsyncCallback } from '../../hooks/useAsyncCallback';
import { isUserId } from '../../utils/matrix';
import { trimTrailingSlash } from '../../utils/common';

// Same key the angaara-bot SDK publishes its command list under.
const COMMANDS_STATE_KEY = 'io.angaara.bot.commands';
const LEGACY_COMMANDS_STATE_KEY = 'io.hearth.bot.commands';

type BotCredentials = {
  homeserver: string;
  userId: string;
  deviceId: string;
  accessToken: string;
};

type BotCommandInfo = {
  name: string;
  description?: string;
  args?: { name: string; type: string; required: boolean }[];
};

type BotEntry = {
  room: Room;
  botId: string;
  prefix: string;
  commands: BotCommandInfo[];
};

// Login body without the device name, which the login callback adds.
type LoginRequest = { type: string; [key: string]: unknown };

const BOT_SSO_MESSAGE = 'angaara-bot-sso';
const SAME_ACCOUNT_ERROR = 'same-account';

// Tokens and passwords only go to https servers (plain http allowed for local testing).
const isSafeHomeserver = (url: string): boolean => {
  try {
    const { protocol, hostname } = new URL(url);
    return protocol === 'https:' || ['localhost', '127.0.0.1', '[::1]'].includes(hostname);
  } catch {
    return false;
  }
};

const BRAND_ICONS: Record<string, SimpleIcon> = {
  google: siGoogle,
  apple: siApple,
  github: siGithub,
  gitlab: siGitlab,
};
// matrix.org lists no providers and always shows its own picker, so these all open that page.
const MATRIX_ORG_BRANDS = ['google', 'apple', 'github', 'gitlab'];
const isMatrixOrg = (url: string): boolean => {
  try {
    return ['matrix.org', 'matrix-client.matrix.org'].includes(new URL(url).hostname);
  } catch {
    return false;
  }
};

function BrandLogo({ icon }: { icon: SimpleIcon }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d={icon.path} />
    </svg>
  );
}

// Google/Apple/GitHub etc. sign-in in a popup, so the user's own session never changes.
function BotSSOButtons({
  homeserver,
  disabled,
  onLoginToken,
}: {
  homeserver: string;
  disabled: boolean;
  onLoginToken: (homeserver: string, token: string) => void;
}) {
  const temp = useMemo(() => createClient({ baseUrl: homeserver }), [homeserver]);
  // undefined: still loading or no SSO. [] means SSO with the provider picked on the server's page.
  const [providers, setProviders] = useState<IIdentityProvider[]>();
  // The token is only accepted from this popup, and only sent to the server it was opened for.
  const pendingRef = useRef<{ popup: Window; homeserver: string }>();

  useEffect(() => {
    let cancelled = false;
    setProviders(undefined);
    if (!isSafeHomeserver(homeserver)) return undefined;
    temp
      .loginFlows()
      .then(({ flows }: { flows: { type: string }[] }) => {
        const sso = flows.find((f) => f.type === 'm.login.sso') as ISSOFlow | undefined;
        if (!cancelled) setProviders(sso && (sso.identity_providers ?? []));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [temp, homeserver]);

  useEffect(() => {
    const onMessage = (evt: MessageEvent) => {
      const pending = pendingRef.current;
      if (!pending || evt.origin !== window.location.origin || evt.source !== pending.popup) return;
      if (evt.data?.type !== BOT_SSO_MESSAGE || typeof evt.data.loginToken !== 'string') return;
      pendingRef.current = undefined;
      onLoginToken(pending.homeserver, evt.data.loginToken);
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [onLoginToken]);

  if (!providers || !isSafeHomeserver(homeserver)) return null;

  const openProvider = (idpId?: string) => {
    const redirectUrl = `${window.location.origin}${trimTrailingSlash(
      import.meta.env.BASE_URL
    )}/bot-sso.html`;
    const url = temp.getSsoLoginUrl(redirectUrl, 'sso', idpId, SSOAction.LOGIN);
    // Unnamed window, so no other page can target or reuse it.
    const popup = window.open(url, '_blank', 'popup,width=520,height=700');
    pendingRef.current = popup ? { popup, homeserver } : undefined;
  };

  type SSOButton = { key: string; label: string; idpId?: string; logo?: ReactNode };
  const pickAgain = providers.length === 0 && isMatrixOrg(homeserver);
  let buttons: SSOButton[];
  if (providers.length > 0) {
    buttons = providers.map((idp) => {
      const brand = idp.brand && BRAND_ICONS[idp.brand];
      const iconUrl = idp.icon && temp.mxcUrlToHttp(idp.icon, 48, 48, 'crop', false);
      let logo: ReactNode;
      if (brand) logo = <BrandLogo icon={brand} />;
      else if (iconUrl) {
        logo = (
          <Avatar size="200" radii="300">
            <AvatarImage src={iconUrl} alt="" />
          </Avatar>
        );
      }
      return { key: idp.id, label: idp.name, idpId: idp.id, logo };
    });
  } else if (pickAgain) {
    buttons = MATRIX_ORG_BRANDS.map((brand) => ({
      key: brand,
      label: BRAND_ICONS[brand].title,
      logo: <BrandLogo icon={BRAND_ICONS[brand]} />,
    }));
  } else {
    buttons = [{ key: 'sso', label: 'Single sign-on' }];
  }

  return (
    <Box direction="Column" gap="200">
      <Text size="T200" priority="300">
        Sign in as your bot with:
      </Text>
      <Box gap="200" wrap="Wrap" alignItems="Center">
        {buttons.map(({ key, label, idpId, logo }) => (
          <Button
            key={key}
            type="button"
            size="400"
            variant="Secondary"
            fill="Soft"
            radii="300"
            outlined
            disabled={disabled}
            onClick={() => openProvider(idpId)}
            aria-label={`Continue with ${label}`}
            title={`Continue with ${label}`}
            before={logo}
          >
            {!logo && <Text size="B300">{label}</Text>}
          </Button>
        ))}
      </Box>
      {pickAgain && (
        <Text size="T200" priority="300">
          matrix.org shows its own sign-in page, so pick the same option once more there.
        </Text>
      )}
      <Text size="T200" priority="300">
        Or use the bot&apos;s username and password:
      </Text>
    </Box>
  );
}

function BotTokenSection({ onCredentials }: { onCredentials: (c: BotCredentials) => void }) {
  const mx = useMatrixClient();
  const [credentials, setCredentials] = useState<BotCredentials>();
  const [showToken, setShowToken] = useState(false);
  const [homeserver, setHomeserver] = useState(mx.baseUrl);

  const [loginState, login] = useAsyncCallback(
    useCallback(
      async (hsUrl: string, body: LoginRequest) => {
        if (!isSafeHomeserver(hsUrl)) throw new Error('Homeserver must use https');
        // Throwaway client: nothing is stored and the user's own session is untouched.
        const temp = createClient({ baseUrl: hsUrl });
        const res = await temp.loginRequest({
          ...body,
          initial_device_display_name: 'Angaara Bot',
        });
        // SSO can silently reuse the browser's Google/GitHub login, which may be the user's own.
        if (res.user_id === mx.getUserId()) {
          await createClient({ baseUrl: hsUrl, accessToken: res.access_token })
            .logout()
            .catch(() => undefined);
          throw new Error(SAME_ACCOUNT_ERROR);
        }
        return {
          homeserver: hsUrl,
          userId: res.user_id,
          deviceId: res.device_id,
          accessToken: res.access_token,
        };
      },
      [mx]
    )
  );
  const loading = loginState.status === AsyncStatus.Loading;

  const finish = (c: BotCredentials) => {
    setCredentials(c);
    setShowToken(false);
    onCredentials(c);
  };

  const handleSubmit: FormEventHandler<HTMLFormElement> = (evt) => {
    evt.preventDefault();
    const form = evt.target as HTMLFormElement;
    const hsUrl = (form.homeserverInput as HTMLInputElement).value.trim();
    const user = (form.botUserInput as HTMLInputElement).value.trim();
    const passwordInput = form.botPasswordInput as HTMLInputElement;
    if (!hsUrl || !user || !passwordInput.value || loading) return;
    login(hsUrl, {
      type: 'm.login.password',
      identifier: { type: 'm.id.user', user },
      password: passwordInput.value,
    }).then((c) => {
      passwordInput.value = '';
      finish(c);
    });
  };

  return (
    <SettingTile
      title="Get Bot Token"
      description="Log in as your bot's account to get an access token. Make the account first, like any Matrix account. Nothing here is saved."
    >
      <Box as="form" onSubmit={handleSubmit} direction="Column" gap="200">
        <Input
          name="homeserverInput"
          defaultValue={mx.baseUrl}
          variant="Secondary"
          radii="300"
          placeholder="Homeserver URL"
          onBlur={(evt) => setHomeserver(evt.currentTarget.value.trim())}
        />
        <BotSSOButtons
          homeserver={homeserver}
          disabled={loading}
          onLoginToken={(hsUrl, token) =>
            login(hsUrl, { type: 'm.login.token', token })
              .then(finish)
              .catch(() => undefined)
          }
        />
        <Input
          name="botUserInput"
          variant="Secondary"
          radii="300"
          placeholder="Enter your bot account username"
          autoComplete="off"
        />
        {/* new-password stops the browser offering your own saved login here. */}
        <PasswordInput
          name="botPasswordInput"
          size="400"
          variant="Secondary"
          radii="300"
          placeholder="Enter your bot account password"
          autoComplete="new-password"
        />
        <Box>
          <Button
            type="submit"
            size="300"
            variant="Primary"
            radii="300"
            disabled={loading}
            before={loading && <Spinner size="100" variant="Primary" fill="Solid" />}
          >
            <Text size="B300">{loading ? 'Logging in...' : 'Get Token'}</Text>
          </Button>
        </Box>
        {loginState.status === AsyncStatus.Error && (
          <Text size="T200" style={{ color: color.Critical.Main }}>
            {(loginState.error as Error | undefined)?.message === SAME_ACCOUNT_ERROR
              ? 'That signed in as your own account, not a bot, so it was logged out again. Sign in with the bot account instead.'
              : 'Login failed. Check the homeserver (it must use https) and the bot login details.'}
          </Text>
        )}
      </Box>
      {credentials && (
        <Box
          direction="Column"
          gap="200"
          style={{
            padding: config.space.S300,
            borderRadius: config.radii.R400,
            background: color.Background.Container,
          }}
        >
          <Text size="T200" style={{ color: color.Warning.Main }}>
            Anyone with this token can act as your bot. Never share it or commit it to git.
          </Text>
          <Text size="T300">
            User ID: <b>{credentials.userId}</b>
          </Text>
          <Text size="T300">
            Device ID: <b>{credentials.deviceId}</b>
          </Text>
          <Text size="T300" style={{ wordBreak: 'break-all' }}>
            Token: <b>{showToken ? credentials.accessToken : '•'.repeat(24)}</b>
          </Text>
          <Box gap="200">
            <Chip variant="SurfaceVariant" radii="Pill" onClick={() => setShowToken((s) => !s)}>
              <Text size="B300">{showToken ? 'Hide' : 'Show'}</Text>
            </Chip>
            <CopyChip value={credentials.accessToken} label="Copy Token" />
          </Box>
        </Box>
      )}
    </SettingTile>
  );
}

function QuickStartSection({ credentials }: { credentials?: BotCredentials }) {
  const homeserver = credentials?.homeserver ?? 'https://matrix.org';
  const userId = credentials?.userId ?? '@yourbot:matrix.org';
  const deviceId = credentials?.deviceId ?? 'YOURDEVICEID';

  const env = [
    `ANGAARA_HOMESERVER=${homeserver}`,
    `ANGAARA_USER_ID=${userId}`,
    `ANGAARA_DEVICE_ID=${deviceId}`,
    'ANGAARA_TOKEN=<paste your token>',
  ].join(' \\\n');

  const code = `use angaara_bot::prelude::*;

#[tokio::main]
async fn main() -> Result<()> {
    let env = |k: &str| std::env::var(k).map_err(|_| Error::other(format!("{k} not set")));
    AngaaraBot::builder()
        .homeserver(env("ANGAARA_HOMESERVER")?)
        .access_token(env("ANGAARA_USER_ID")?, env("ANGAARA_DEVICE_ID")?, env("ANGAARA_TOKEN")?)
        .command(Command::new("ping").description("Check the bot is alive").run(|ctx| async move {
            ctx.reply("pong").await?;
            Ok(())
        }))
        .run()
        .await
}`;

  return (
    <SettingTile
      title="Quick Start"
      description="A minimal angaara-bot in Rust. Add angaara-bot and tokio to Cargo.toml, then run it with your token."
    >
      <CodeBlock code={code} />
      <CodeBlock code={`${env} \\\ncargo run`} />
    </SettingTile>
  );
}

function InviteBotSection({ defaultUserId }: { defaultUserId?: string }) {
  const mx = useMatrixClient();
  const rooms = useMemo(
    () =>
      mx
        .getRooms()
        .filter((r: Room) => r.getMyMembership() === 'join' && !r.isSpaceRoom())
        .sort((a: Room, b: Room) => a.name.localeCompare(b.name)),
    [mx]
  );
  const [roomId, setRoomId] = useState(rooms[0]?.roomId ?? '');

  const [inviteState, invite] = useAsyncCallback(
    useCallback((room: string, userId: string) => mx.invite(room, userId), [mx])
  );
  const inviting = inviteState.status === AsyncStatus.Loading;

  const handleSubmit: FormEventHandler<HTMLFormElement> = (evt) => {
    evt.preventDefault();
    const input = (evt.target as HTMLFormElement).botIdInput as HTMLInputElement;
    const userId = input.value.trim();
    if (!isUserId(userId) || !roomId || inviting) return;
    invite(roomId, userId);
  };

  return (
    <SettingTile
      title="Invite Bot"
      description="Invite your bot to a room. angaara-bot joins automatically."
    >
      <Box as="form" onSubmit={handleSubmit} direction="Column" gap="200">
        <Input
          key={defaultUserId}
          name="botIdInput"
          defaultValue={defaultUserId}
          variant="Secondary"
          radii="300"
          placeholder="@yourbot:matrix.org"
        />
        <select
          value={roomId}
          onChange={(e) => setRoomId(e.target.value)}
          aria-label="Room"
          style={{
            padding: config.space.S300,
            borderRadius: config.radii.R300,
            background: color.Secondary.Container,
            color: color.Secondary.OnContainer,
            border: `1px solid ${color.Secondary.ContainerLine}`,
          }}
        >
          {rooms.map((r: Room) => (
            <option key={r.roomId} value={r.roomId}>
              {r.name}
            </option>
          ))}
        </select>
        <Box>
          <Button
            type="submit"
            size="300"
            variant="Secondary"
            fill="Soft"
            radii="300"
            disabled={inviting || rooms.length === 0}
            before={inviting && <Spinner size="100" variant="Secondary" />}
          >
            <Text size="B300">Invite</Text>
          </Button>
        </Box>
        {inviteState.status === AsyncStatus.Success && (
          <Text size="T200" style={{ color: color.Success.Main }}>
            Invite sent.
          </Text>
        )}
        {inviteState.status === AsyncStatus.Error && (
          <Text size="T200" style={{ color: color.Critical.Main }}>
            Couldn&apos;t invite. You may not have permission in that room.
          </Text>
        )}
      </Box>
    </SettingTile>
  );
}

function BotInspectorSection() {
  const mx = useMatrixClient();
  const bots: BotEntry[] = useMemo(
    () =>
      mx
        .getRooms()
        .filter((r: Room) => r.getMyMembership() === 'join')
        .flatMap((room: Room) =>
          [
            ...room.currentState.getStateEvents(COMMANDS_STATE_KEY),
            // Bots on an older SDK, skipped when the bot also published the new key.
            ...room.currentState
              .getStateEvents(LEGACY_COMMANDS_STATE_KEY)
              .filter(
                (ev: MatrixEvent) =>
                  !room.currentState.getStateEvents(COMMANDS_STATE_KEY, ev.getStateKey() ?? '')
              ),
          ].map((ev: MatrixEvent) => ({
            room,
            botId: ev.getStateKey() ?? '',
            prefix: (ev.getContent().prefix as string | undefined) ?? '!',
            commands: (ev.getContent().commands as BotCommandInfo[] | undefined) ?? [],
          }))
        )
        .filter((bot: BotEntry) => bot.botId && bot.commands.length > 0),
    [mx]
  );

  return (
    <SettingTile
      title="Bot Inspector"
      description="Bots in your rooms and the commands they've published."
    >
      {bots.length === 0 && (
        <Text size="T300" priority="300">
          No bots have published commands in your rooms yet.
        </Text>
      )}
      {bots.map((bot: BotEntry) => (
        <Box
          key={`${bot.room.roomId}:${bot.botId}`}
          direction="Column"
          gap="100"
          style={{
            padding: config.space.S300,
            borderRadius: config.radii.R400,
            background: color.Background.Container,
          }}
        >
          <Box alignItems="Center" gap="200">
            <Icon size="100" src={Icons.Terminal} />
            <Text size="T300" truncate>
              <b>{bot.botId}</b> in {bot.room.name}
            </Text>
          </Box>
          {bot.commands.map((cmd: BotCommandInfo) => (
            <Text key={cmd.name} size="T200" priority="300">
              <code>
                {bot.prefix}
                {cmd.name}
                {(cmd.args ?? []).map((a: NonNullable<BotCommandInfo['args']>[number]) =>
                  a.required ? ` <${a.name}>` : ` [${a.name}]`
                )}
              </code>
              {cmd.description && ` · ${cmd.description}`}
            </Text>
          ))}
        </Box>
      ))}
    </SettingTile>
  );
}

const mainFileOf = ({ root, files }: Workspace): string => {
  const preferred = ['src/main.rs', 'src/lib.rs', 'README.md', 'Cargo.toml'].map(
    (name) => `${root}/${name}`
  );
  return preferred.find((path) => files.some((f) => f.path === path)) ?? files[0]?.path ?? '';
};

// Loose files land in the project root, replacing any file with the same path.
const mergeFiles = (files: ZipFile[], added: ZipFile[]): ZipFile[] => {
  const byPath = new Map(files.map((f) => [f.path, f]));
  added.forEach((f) => byPath.set(f.path, f));
  return [...byPath.values()].sort((a, b) => a.path.localeCompare(b.path));
};

type ImportNotice = { text: string; tone: 'info' | 'error'; undo?: Workspace };

function Card({ children }: { children: ReactNode }) {
  return (
    <SequenceCard
      className={SequenceCardStyle}
      variant="SurfaceVariant"
      direction="Column"
      gap="400"
    >
      {children}
    </SequenceCard>
  );
}

export function DeveloperBot() {
  const [credentials, setCredentials] = useState<BotCredentials>();

  return (
    <Box direction="Column" gap="700">
      <Box direction="Column" gap="100">
        <Text size="L400">Account</Text>
        <Card>
          <BotTokenSection onCredentials={setCredentials} />
        </Card>
        <Card>
          <InviteBotSection defaultUserId={credentials?.userId} />
        </Card>
      </Box>
      <Box direction="Column" gap="100">
        <Text size="L400">Run It</Text>
        <Card>
          <QuickStartSection credentials={credentials} />
        </Card>
        <Card>
          <BotInspectorSection />
        </Card>
      </Box>
    </Box>
  );
}

export function DeveloperBuild() {
  const [workspace, setWorkspace] = useAtom(workspaceAtom);
  const [notice, setNotice] = useState<ImportNotice>();
  const [importing, setImporting] = useState(false);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const filesInputRef = useRef<HTMLInputElement>(null);
  const savedFiles = useAtomValue(savedFilesAtom);
  // Only known once something was saved to the runner.
  const dirtyPaths = useMemo(() => {
    if (!savedFiles) return undefined;
    const saved = new Map(savedFiles.map((f) => [f.path, f.content]));
    return new Set(
      workspace.files.filter((f) => saved.get(f.path) !== f.content).map((f) => f.path)
    );
  }, [savedFiles, workspace.files]);

  const handleReplaceFiles = useCallback(
    (files: ZipFile[]) => setWorkspace((ws) => ({ ...ws, files })),
    [setWorkspace]
  );
  const handleOpenFromRunner = useCallback(
    (root: string, files: ZipFile[]) => {
      setNotice({ text: `Opened ${root} from the runner.`, tone: 'info', undo: workspace });
      setWorkspace({ root, files, starter: false });
    },
    [workspace, setWorkspace]
  );

  const handleFileChange = useCallback(
    (path: string, content: string) =>
      setWorkspace((ws) => ({
        ...ws,
        files: ws.files.map((f) => (f.path === path ? { ...f, content } : f)),
      })),
    [setWorkspace]
  );

  const importPicked = useCallback(
    async (load: () => Promise<PickedFile[]>) => {
      setImporting(true);
      setNotice(undefined);
      try {
        const result = await readPicked(await load());
        const skipped = describeSkipped(result.skipped);
        const skippedText = skipped ? ` Skipped ${skipped}.` : '';
        if (result.files.length === 0) {
          setNotice({
            text: `No text files to import.${skippedText} Build folders like target/ and node_modules/ are always left out.`,
            tone: 'error',
          });
          return;
        }
        const previous = workspace;
        if (result.root) {
          setWorkspace({ root: result.root, files: result.files, starter: false });
          setNotice({
            text: `Opened ${result.root} (${result.files.length} files).${skippedText}`,
            tone: 'info',
            undo: previous,
          });
        } else {
          const added = result.files.map((f) => ({ ...f, path: `${previous.root}/${f.path}` }));
          setWorkspace({ ...previous, files: mergeFiles(previous.files, added) });
          setNotice({
            text: `Added ${added.length} file${added.length === 1 ? '' : 's'}.${skippedText}`,
            tone: 'info',
            undo: previous,
          });
        }
      } catch {
        setNotice({ text: "Couldn't read those files. Please try again.", tone: 'error' });
      } finally {
        setImporting(false);
      }
    },
    [workspace, setWorkspace]
  );

  const handleDrop = useCallback(
    ({ entries, files }: DroppedItems) =>
      importPicked(async () =>
        entries.length > 0 ? pickedFromEntries(entries) : pickedFromInput(files)
      ),
    [importPicked]
  );
  const handleInput = (evt: ChangeEvent<HTMLInputElement>) => {
    const input = evt.currentTarget;
    const picked = input.files ? pickedFromInput(input.files) : [];
    input.value = '';
    importPicked(async () => picked);
  };

  const actions = (
    <>
      <RunnerEditorActions files={workspace.files} />
      <GitHubEditorActions />
      <Chip
        variant="SurfaceVariant"
        radii="Pill"
        disabled={importing}
        onClick={() => folderInputRef.current?.click()}
        before={
          importing ? (
            <Spinner size="50" variant="Secondary" />
          ) : (
            <Icon size="50" src={Icons.Category} />
          )
        }
      >
        <Text size="B300">Open Folder</Text>
      </Chip>
      <Chip
        variant="SurfaceVariant"
        radii="Pill"
        disabled={importing}
        onClick={() => filesInputRef.current?.click()}
        before={<Icon size="50" src={Icons.Plus} />}
      >
        <Text size="B300">Add Files</Text>
      </Chip>
      {!workspace.starter && (
        <Chip
          variant="SurfaceVariant"
          radii="Pill"
          disabled={importing}
          onClick={() => {
            setNotice({ text: 'Back to the starter project.', tone: 'info', undo: workspace });
            setWorkspace(STARTER_WORKSPACE);
          }}
        >
          <Text size="B300">Use Starter</Text>
        </Chip>
      )}
      <input
        ref={folderInputRef}
        type="file"
        hidden
        // Non-standard but supported by every major browser: pick a whole folder.
        {...{ webkitdirectory: '' }}
        onChange={handleInput}
      />
      <input ref={filesInputRef} type="file" multiple hidden onChange={handleInput} />
    </>
  );

  return (
    <Box direction="Column" gap="700">
      <Box direction="Column" gap="100">
        <Text size="L400">GitHub</Text>
        <GitHubLinkBar />
      </Box>
      <Box direction="Column" gap="100">
        <Text size="L400">{workspace.starter ? 'Starter Project' : 'Project'}</Text>
        <Card>
          <SettingTile
            title={workspace.root}
            description={
              workspace.starter
                ? 'A ready-to-run bot with the angaara-bot SDK included. Edit files here, drop in your own project folder, or open one from your runner. Edits sync to your account.'
                : 'Your project. Edits sync to your account; Save (Ctrl+S) also sends them to your runner.'
            }
          >
            <ProjectSync
              root={workspace.root}
              files={workspace.files}
              onReplaceFiles={handleReplaceFiles}
              onOpen={handleOpenFromRunner}
            />
            <ProjectExplorer
              files={workspace.files}
              onChange={handleFileChange}
              zipName={`${workspace.root}.zip`}
              initialFile={mainFileOf(workspace)}
              initiallyCollapsed={workspace.starter ? [`${STARTER_ROOT}/angaara-bot`] : []}
              sdkPrefix={`${workspace.root}/angaara-bot/`}
              onDropItems={handleDrop}
              actions={actions}
              panel={<RunnerTerminal />}
              status={<RunnerStatusItem />}
              dirtyPaths={dirtyPaths}
            />
            {notice && (
              <Box alignItems="Center" gap="200" wrap="Wrap">
                <Text
                  size="T200"
                  style={{ color: notice.tone === 'error' ? color.Critical.Main : undefined }}
                >
                  {notice.text}
                </Text>
                {notice.undo && (
                  <Chip
                    variant="SurfaceVariant"
                    radii="Pill"
                    onClick={() => {
                      if (notice.undo) setWorkspace(notice.undo);
                      setNotice(undefined);
                    }}
                  >
                    <Text size="B300">Undo</Text>
                  </Chip>
                )}
              </Box>
            )}
          </SettingTile>
        </Card>
        <GitHubCommitPanel />
      </Box>
      <Box direction="Column" gap="100">
        <Text size="L400">Runner</Text>
        <Card>
          <SettingTile
            title="Your Runner"
            description="Build, run and shell into this project on a computer you own with angaara-runner, over an end-to-end encrypted room. Only your account can use it. Its terminal is docked under the editor."
          >
            <RunnerPanel files={workspace.files} projectRoot={workspace.root} />
          </SettingTile>
        </Card>
      </Box>
    </Box>
  );
}

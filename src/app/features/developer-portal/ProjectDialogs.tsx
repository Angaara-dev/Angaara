import React, { FormEvent, ReactNode, useRef, useState } from 'react';
import { useAtom, useAtomValue } from 'jotai';
import { useNavigate } from 'react-router-dom';
import FocusTrap from 'focus-trap-react';
import {
  Box,
  Button,
  Dialog,
  Header,
  Icon,
  IconButton,
  Icons,
  Input,
  Overlay,
  OverlayBackdrop,
  OverlayCenter,
  Spinner,
  Text,
  color,
  config,
} from 'folds';
import { stopPropagation } from '../../utils/keyboard';
import { getHomeDeveloperPath } from '../../pages/pathUtils';
import { CopyChip } from './CodeBlock';
import { devKeyAtom, ProjectMeta, projectDialogAtom, useProjectIndex } from './projects';
import { useProjectActions } from './useDevProjects';
import { clearLegacyWorkspace, loadLegacyWorkspace, STARTER_WORKSPACE } from './workspace';

export const MIN_PASSWORD = 8;

function DialogShell({
  title,
  onClose,
  locked,
  children,
}: {
  title: string;
  onClose: () => void;
  // The recovery key step can't be dismissed by clicking outside or pressing Esc.
  locked?: boolean;
  children: ReactNode;
}) {
  // The focus trap reads its options once, so it checks these refs for the current step.
  const lockedRef = useRef(locked);
  lockedRef.current = locked;
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  return (
    <Overlay open backdrop={<OverlayBackdrop />}>
      <OverlayCenter>
        <FocusTrap
          focusTrapOptions={{
            initialFocus: false,
            onDeactivate: () => {
              if (!lockedRef.current) closeRef.current();
            },
            clickOutsideDeactivates: () => !lockedRef.current,
            escapeDeactivates: (evt: KeyboardEvent) => !lockedRef.current && stopPropagation(evt),
          }}
        >
          <Dialog variant="Surface" style={{ maxWidth: '30rem', width: '100%' }}>
            <Header
              style={{ padding: `0 ${config.space.S200} 0 ${config.space.S400}` }}
              variant="Surface"
              size="500"
            >
              <Box grow="Yes">
                <Text size="H4">{title}</Text>
              </Box>
              {!locked && (
                <IconButton size="300" onClick={onClose} radii="300" aria-label="Close">
                  <Icon src={Icons.Cross} />
                </IconButton>
              )}
            </Header>
            <Box direction="Column" gap="400" style={{ padding: config.space.S400, paddingTop: 0 }}>
              {children}
            </Box>
          </Dialog>
        </FocusTrap>
      </OverlayCenter>
    </Overlay>
  );
}

export function ErrorText({ text }: { text?: string }) {
  if (!text) return null;
  return (
    <Text size="T200" style={{ color: color.Critical.Main }}>
      {text}
    </Text>
  );
}

export function PasswordField({
  label,
  value,
  onChange,
  autoFocus,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  autoFocus?: boolean;
}) {
  return (
    <Box direction="Column" gap="100">
      <Text size="L400">{label}</Text>
      <Input
        type="password"
        size="500"
        variant="Background"
        autoComplete="new-password"
        autoFocus={autoFocus}
        value={value}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
      />
    </Box>
  );
}

// Checks a new password pair; returns the problem, if any.
export const newPasswordProblem = (password: string, confirm: string) => {
  if (password.length < MIN_PASSWORD) return `Use at least ${MIN_PASSWORD} characters.`;
  if (password !== confirm) return "The passwords don't match.";
  return undefined;
};

function ChoiceCard({
  selected,
  onSelect,
  icon,
  title,
  text,
}: {
  selected: boolean;
  onSelect: () => void;
  icon: typeof Icons.Lock;
  title: string;
  text: string;
}) {
  return (
    <Box
      as="button"
      type="button"
      onClick={onSelect}
      gap="300"
      aria-pressed={selected}
      style={{
        textAlign: 'left',
        cursor: 'pointer',
        color: 'inherit',
        padding: config.space.S300,
        borderRadius: config.radii.R400,
        background: selected ? color.Primary.Container : color.Background.Container,
        border: `1px solid ${selected ? color.Primary.Main : color.Background.ContainerLine}`,
      }}
    >
      <Icon src={icon} size="200" />
      <Box direction="Column" gap="100">
        <Text size="T300">
          <b>{title}</b>
        </Text>
        <Text size="T200" priority="300">
          {text}
        </Text>
      </Box>
    </Box>
  );
}

function RecoveryKeyStep({ recoveryKey, onDone }: { recoveryKey: string; onDone: () => void }) {
  const [saved, setSaved] = useState(false);
  return (
    <>
      <Text size="T300">
        This is your recovery key. If you forget your dev password, it&apos;s the only way back into
        your encrypted projects. It&apos;s shown once, so save it somewhere safe, like a password
        manager.
      </Text>
      <Box
        direction="Column"
        gap="200"
        style={{
          padding: config.space.S300,
          borderRadius: config.radii.R400,
          border: `1px solid ${color.Background.ContainerLine}`,
        }}
      >
        <Text size="T300" style={{ fontFamily: 'monospace', wordBreak: 'break-all' }}>
          {recoveryKey}
        </Text>
        <Box>
          <CopyChip value={recoveryKey} label="Copy Recovery Key" />
        </Box>
      </Box>
      <Box as="label" gap="200" alignItems="Center">
        <input type="checkbox" checked={saved} onChange={(e) => setSaved(e.target.checked)} />
        <Text size="T300">I&apos;ve saved my recovery key</Text>
      </Box>
      <Button variant="Primary" disabled={!saved} onClick={onDone}>
        <Text size="B400">Done</Text>
      </Button>
    </>
  );
}

function NewProjectDialog({ onClose }: { onClose: () => void }) {
  const index = useProjectIndex();
  const key = useAtomValue(devKeyAtom);
  const { create } = useProjectActions();
  const navigate = useNavigate();
  const [legacy] = useState(loadLegacyWorkspace);
  const [name, setName] = useState(`Project ${index.projects.length + 1}`);
  const [encrypted, setEncrypted] = useState<boolean>();
  const [bringLegacy, setBringLegacy] = useState(true);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [recoveryKey, setRecoveryKey] = useState<string>();

  const makesPassword = encrypted === true && !index.lock;
  const needsPassword = encrypted === true && !!index.lock && !key;

  const finish = () => {
    onClose();
    navigate(getHomeDeveloperPath('build'));
  };

  const submit = async (evt: FormEvent) => {
    evt.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Give the project a name.');
      return;
    }
    if (encrypted === undefined) {
      setError('Choose whether to encrypt this project.');
      return;
    }
    const problem = makesPassword ? newPasswordProblem(password, confirm) : undefined;
    if (problem) {
      setError(problem);
      return;
    }
    setBusy(true);
    setError(undefined);
    try {
      const useLegacy = !!legacy && bringLegacy;
      const made = await create({
        name: trimmed.slice(0, 60),
        encrypted,
        password: makesPassword || needsPassword ? password : undefined,
        ws: useLegacy && legacy ? legacy : STARTER_WORKSPACE,
      });
      if (useLegacy) clearLegacyWorkspace();
      if (made) setRecoveryKey(made);
      else finish();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't create the project.");
    } finally {
      setBusy(false);
    }
  };

  if (recoveryKey) {
    return (
      <DialogShell title="Save Your Recovery Key" onClose={finish} locked>
        <RecoveryKeyStep recoveryKey={recoveryKey} onDone={finish} />
      </DialogShell>
    );
  }

  return (
    <DialogShell title="New Project" onClose={onClose}>
      <Box as="form" direction="Column" gap="400" onSubmit={submit}>
        <Box direction="Column" gap="100">
          <Text size="L400">Name</Text>
          <Input
            size="500"
            variant="Background"
            autoFocus
            maxLength={60}
            value={name}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
          />
        </Box>
        <Box direction="Column" gap="200">
          <Text size="L400">Encryption (can&apos;t be changed later)</Text>
          <ChoiceCard
            selected={encrypted === true}
            onSelect={() => setEncrypted(true)}
            icon={Icons.Lock}
            title="Encrypted"
            text="Only you can read it. New devices need your dev password to open it."
          />
          <ChoiceCard
            selected={encrypted === false}
            onSelect={() => setEncrypted(false)}
            icon={Icons.Category}
            title="Not encrypted"
            text="Opens on any device you're signed in to. Your homeserver can read it."
          />
        </Box>
        {makesPassword && (
          <Box direction="Column" gap="200">
            <Text size="T200" priority="300">
              Set a dev password. It unlocks all your encrypted projects.
            </Text>
            <PasswordField label="Dev Password" value={password} onChange={setPassword} />
            <PasswordField label="Confirm Password" value={confirm} onChange={setConfirm} />
          </Box>
        )}
        {needsPassword && (
          <PasswordField label="Dev Password" value={password} onChange={setPassword} />
        )}
        {legacy && (
          <Box as="label" gap="200" alignItems="Center">
            <input
              type="checkbox"
              checked={bringLegacy}
              onChange={(e) => setBringLegacy(e.target.checked)}
            />
            <Text size="T300">Start from the project saved in this browser ({legacy.root})</Text>
          </Box>
        )}
        <ErrorText text={error} />
        <Button
          type="submit"
          variant="Primary"
          disabled={busy}
          before={busy ? <Spinner size="100" variant="Primary" fill="Solid" /> : undefined}
        >
          <Text size="B400">Create Project</Text>
        </Button>
      </Box>
    </DialogShell>
  );
}

function RenameDialog({ project, onClose }: { project: ProjectMeta; onClose: () => void }) {
  const { rename } = useProjectActions();
  const [name, setName] = useState(project.name);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  const submit = async (evt: FormEvent) => {
    evt.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    setBusy(true);
    try {
      await rename(project.id, trimmed.slice(0, 60));
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't rename the project.");
      setBusy(false);
    }
  };

  return (
    <DialogShell title="Rename Project" onClose={onClose}>
      <Box as="form" direction="Column" gap="400" onSubmit={submit}>
        <Input
          size="500"
          variant="Background"
          autoFocus
          maxLength={60}
          value={name}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
        />
        <ErrorText text={error} />
        <Button type="submit" variant="Primary" disabled={busy || !name.trim()}>
          <Text size="B400">Rename</Text>
        </Button>
      </Box>
    </DialogShell>
  );
}

function DeleteDialog({ project, onClose }: { project: ProjectMeta; onClose: () => void }) {
  const { remove } = useProjectActions();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  const confirmDelete = async () => {
    setBusy(true);
    try {
      await remove(project.id);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't delete the project.");
      setBusy(false);
    }
  };

  return (
    <DialogShell title="Delete Project" onClose={onClose}>
      <Text size="T300">
        Delete <b>{project.name}</b>? It&apos;s removed from every device you&apos;re signed in to,
        and it can&apos;t be undone. Anything already pushed to GitHub stays there.
      </Text>
      <ErrorText text={error} />
      <Button variant="Critical" disabled={busy} onClick={confirmDelete}>
        <Text size="B400">Delete Project</Text>
      </Button>
    </DialogShell>
  );
}

// Whichever project dialog is open. Lazy-loaded by the sidebar.
export default function ProjectDialogs() {
  const [dialog, setDialog] = useAtom(projectDialogAtom);
  const close = () => setDialog(undefined);
  if (!dialog) return null;
  if (dialog.kind === 'new') return <NewProjectDialog onClose={close} />;
  if (dialog.kind === 'rename') return <RenameDialog project={dialog.project} onClose={close} />;
  return <DeleteDialog project={dialog.project} onClose={close} />;
}

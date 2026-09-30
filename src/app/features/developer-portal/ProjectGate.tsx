import React, { FormEvent, ReactNode, useState } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';
import { Box, Button, Icon, Icons, Input, Spinner, Text, color, config } from 'folds';
import { ProjectMeta, projectDialogAtom, projectStatusAtom, saveStateAtom } from './projects';
import { useProjectActions } from './useDevProjects';
import { ErrorText, newPasswordProblem, PasswordField } from './ProjectDialogs';
import { LoadingQuips } from './LoadingQuips';

function GateCard({ children }: { children: ReactNode }) {
  return (
    <Box
      direction="Column"
      gap="400"
      style={{
        maxWidth: '28rem',
        width: '100%',
        margin: '0 auto',
        padding: config.space.S400,
        borderRadius: config.radii.R400,
        background: color.Background.Container,
        border: `1px solid ${color.Background.ContainerLine}`,
      }}
    >
      {children}
    </Box>
  );
}

function LinkButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <Text
      as="button"
      type="button"
      size="T200"
      onClick={onClick}
      style={{
        background: 'none',
        border: 'none',
        padding: 0,
        cursor: 'pointer',
        color: color.Primary.Main,
        textAlign: 'left',
      }}
    >
      {children}
    </Text>
  );
}

function SubmitButton({
  busy,
  label,
  critical,
}: {
  busy: boolean;
  label: string;
  critical?: boolean;
}) {
  return (
    <Button
      type="submit"
      variant={critical ? 'Critical' : 'Primary'}
      disabled={busy}
      before={busy ? <Spinner size="100" variant="Secondary" /> : undefined}
    >
      <Text size="B400">{label}</Text>
    </Button>
  );
}

function UnlockPanel({ project }: { project: ProjectMeta }) {
  const { unlock, recover, resetEncrypted } = useProjectActions();
  const [mode, setMode] = useState<'password' | 'recover' | 'reset'>('password');
  const [password, setPassword] = useState('');
  const [recoveryKey, setRecoveryKey] = useState('');
  const [confirm, setConfirm] = useState('');
  const [sure, setSure] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  const switchMode = (next: typeof mode) => {
    setMode(next);
    setPassword('');
    setConfirm('');
    setError(undefined);
  };
  const run = async (evt: FormEvent, action: () => Promise<unknown>) => {
    evt.preventDefault();
    setBusy(true);
    setError(undefined);
    try {
      await action();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
      setBusy(false);
    }
  };

  if (mode === 'recover') {
    return (
      <GateCard>
        <Text size="H4">Reset Your Dev Password</Text>
        <Box
          as="form"
          direction="Column"
          gap="300"
          onSubmit={(evt: FormEvent) => {
            const problem = newPasswordProblem(password, confirm);
            if (problem) {
              evt.preventDefault();
              setError(problem);
              return;
            }
            run(evt, () => recover(recoveryKey, password));
          }}
        >
          <Box direction="Column" gap="100">
            <Text size="L400">Recovery Key</Text>
            <Input
              size="500"
              variant="Background"
              autoFocus
              autoComplete="off"
              placeholder="ABCD-EFGH-..."
              value={recoveryKey}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setRecoveryKey(e.target.value)}
            />
          </Box>
          <PasswordField label="New Dev Password" value={password} onChange={setPassword} />
          <PasswordField label="Confirm Password" value={confirm} onChange={setConfirm} />
          <ErrorText text={error} />
          <SubmitButton busy={busy} label="Reset Password" />
        </Box>
        <Box direction="Column" gap="100" alignItems="Start">
          <LinkButton onClick={() => switchMode('password')}>Back to password</LinkButton>
          <LinkButton onClick={() => switchMode('reset')}>Lost your recovery key too?</LinkButton>
        </Box>
      </GateCard>
    );
  }

  if (mode === 'reset') {
    return (
      <GateCard>
        <Text size="H4">Start Over</Text>
        <Text size="T300">
          Without your password or recovery key, nobody can open your encrypted projects, not even
          us. Starting over deletes every encrypted project from your account on all devices.
          Projects that aren&apos;t encrypted, and anything already on GitHub, stay.
        </Text>
        <Box
          as="form"
          direction="Column"
          gap="300"
          onSubmit={(evt: FormEvent) => run(evt, resetEncrypted)}
        >
          <Box as="label" gap="200" alignItems="Center">
            <input type="checkbox" checked={sure} onChange={(e) => setSure(e.target.checked)} />
            <Text size="T300">I understand my encrypted projects will be deleted</Text>
          </Box>
          <ErrorText text={error} />
          <Button
            type="submit"
            variant="Critical"
            disabled={busy || !sure}
            before={busy ? <Spinner size="100" variant="Secondary" /> : undefined}
          >
            <Text size="B400">Delete Encrypted Projects</Text>
          </Button>
        </Box>
        <LinkButton onClick={() => switchMode('recover')}>Back</LinkButton>
      </GateCard>
    );
  }

  return (
    <GateCard>
      <Box gap="200" alignItems="Center">
        <Icon src={Icons.Lock} size="200" />
        <Text size="H4">{project.name}</Text>
      </Box>
      <Box
        as="form"
        direction="Column"
        gap="300"
        onSubmit={(evt: FormEvent) => run(evt, () => unlock(password))}
      >
        <Text size="T300">Enter your password to access your developer workspace.</Text>
        <PasswordField label="Dev Password" value={password} onChange={setPassword} autoFocus />
        <ErrorText text={error} />
        <SubmitButton busy={busy} label="Unlock" />
      </Box>
      <LinkButton onClick={() => switchMode('recover')}>Forgot your password?</LinkButton>
    </GateCard>
  );
}

function SaveLine({ project }: { project: ProjectMeta }) {
  const save = useAtomValue(saveStateAtom);
  let text = 'Saved to your account';
  if (save.state === 'saving') text = 'Saving...';
  if (save.state === 'error') text = save.text;
  return (
    <Box gap="200" alignItems="Center" wrap="Wrap">
      <Icon src={project.encrypted ? Icons.Lock : Icons.Category} size="100" />
      <Text size="T300">
        <b>{project.name}</b>
      </Text>
      <Text size="T200" priority="300">
        {project.encrypted ? 'Encrypted' : 'Not encrypted'}
      </Text>
      <Box grow="Yes" />
      <Text
        size="T200"
        priority="300"
        style={save.state === 'error' ? { color: color.Critical.Main } : undefined}
      >
        {text}
      </Text>
    </Box>
  );
}

// Pages that use the workspace only render once a project is open and unlocked.
export function ProjectGate({ children }: { children: ReactNode }) {
  const status = useAtomValue(projectStatusAtom);
  const setDialog = useSetAtom(projectDialogAtom);

  if (status.status === 'loading') return <LoadingQuips />;
  if (status.status === 'none') {
    return (
      <GateCard>
        <Text size="H4">No Projects Yet</Text>
        <Text size="T300">
          Projects hold your bot&apos;s code and sync to every device you&apos;re signed in to. Make
          one to get started.
        </Text>
        <Button variant="Primary" onClick={() => setDialog({ kind: 'new' })}>
          <Text size="B400">New Project</Text>
        </Button>
      </GateCard>
    );
  }
  if (status.status === 'locked') return <UnlockPanel project={status.project} />;
  if (status.status === 'error') {
    return (
      <GateCard>
        <Text size="H4">Couldn&apos;t Open {status.project.name}</Text>
        <Text size="T300">
          Its saved data couldn&apos;t be read. It may be damaged, or saved by a newer version of
          Angaara.
        </Text>
      </GateCard>
    );
  }
  return (
    <Box direction="Column" gap="400">
      <SaveLine project={status.project} />
      {children}
    </Box>
  );
}

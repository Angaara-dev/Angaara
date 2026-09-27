import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useAtomValue } from 'jotai';
import { Box, Chip, color, config, Icon, Icons, Spinner, Text } from 'folds';
import { ZipFile } from '../../utils/zip';
import { savedFilesAtom, useRunnerBridge } from './RunnerPanel';
import { DiffReview } from './DiffReview';
import { Change, diffFiles, takeRemote } from './diff';

type CheckState =
  | { status: 'idle' }
  | { status: 'checking' }
  | { status: 'missing' }
  | { status: 'error'; message: string }
  | { status: 'done'; runner: ZipFile[] };

type ProjectSyncProps = {
  root: string;
  files: ZipFile[];
  onReplaceFiles: (files: ZipFile[]) => void;
  onOpen: (root: string, files: ZipFile[]) => void;
};
// Compares the editor with the runner's copy of the project, GitHub style.
export function ProjectSync({ root, files, onReplaceFiles, onOpen }: ProjectSyncProps) {
  const { pull, projects, save } = useRunnerBridge();
  const savedFiles = useAtomValue(savedFilesAtom);
  const [check, setCheck] = useState<CheckState>({ status: 'idle' });
  const [checkedAt, setCheckedAt] = useState<Date>();
  const [open, setOpen] = useState(false);
  const [opening, setOpening] = useState(false);
  const [openError, setOpenError] = useState<string>();

  // Asks the runner directly; its project list is only as fresh as the last connect.
  const refresh = useCallback(
    async (openIfChanged?: boolean) => {
      if (!pull) return;
      setCheck({ status: 'checking' });
      try {
        const runner = await pull(root);
        setCheck({ status: 'done', runner });
        setCheckedAt(new Date());
        if (openIfChanged) setOpen(true);
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Could not check.';
        setCheck(
          message === 'project not found' ? { status: 'missing' } : { status: 'error', message }
        );
      }
    },
    [pull, root]
  );

  // Check once when the runner connects or another project opens.
  const canCheck = !!pull;
  useEffect(() => {
    if (canCheck) refresh();
    else setCheck({ status: 'idle' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canCheck, root]);

  // A successful Save means the runner now has exactly what was sent.
  useEffect(() => {
    if (savedFiles?.some((f) => f.path.startsWith(`${root}/`))) {
      setCheck({ status: 'done', runner: savedFiles });
      setCheckedAt(new Date());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedFiles]);

  const changes = useMemo(
    () => (check.status === 'done' ? diffFiles(files, check.runner, root) : []),
    [check, files, root]
  );

  const openFromRunner = async (project: string) => {
    if (!pull || !project) return;
    setOpening(true);
    setOpenError(undefined);
    try {
      const pulled = await pull(project);
      onOpen(project, pulled);
      setCheck({ status: 'done', runner: pulled });
      setCheckedAt(new Date());
    } catch (e) {
      setOpenError(e instanceof Error ? e.message : 'Could not open the project.');
    } finally {
      setOpening(false);
    }
  };

  if (!pull) return null;

  let summary: string;
  if (check.status === 'checking') summary = 'Comparing with the runner...';
  else if (check.status === 'missing') summary = 'Not on the runner yet. Save (Ctrl+S) uploads it.';
  else if (check.status === 'error') summary = `Couldn't compare: ${check.message}`;
  else if (check.status === 'done' && changes.length === 0) summary = 'In sync with the runner';
  else if (check.status === 'done')
    summary = `${changes.length} file${changes.length === 1 ? '' : 's'} differ from the runner`;
  else summary = 'Runner connected';
  const differs = check.status === 'done' && changes.length > 0;

  return (
    <Box
      direction="Column"
      gap="200"
      style={{
        padding: config.space.S300,
        borderRadius: config.radii.R400,
        background: color.Background.Container,
        color: color.Background.OnContainer,
        border: `1px solid ${differs ? color.Warning.Main : color.Background.ContainerLine}`,
      }}
    >
      <Box gap="200" alignItems="Center" wrap="Wrap">
        {check.status === 'checking' ? (
          <Spinner size="100" variant="Secondary" />
        ) : (
          <Icon size="100" src={differs ? Icons.Warning : Icons.Check} />
        )}
        <Text size="T300">{summary}</Text>
        {checkedAt && check.status === 'done' && (
          <Text size="T200" priority="300">
            checked {checkedAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
          </Text>
        )}
        <Box grow="Yes" />
        {differs && (
          <Chip
            variant={open ? 'Primary' : 'Warning'}
            radii="Pill"
            aria-pressed={open}
            onClick={() => setOpen((v) => !v)}
          >
            <Text size="B300">{open ? 'Hide Changes' : 'Review Changes'}</Text>
          </Chip>
        )}
        <Chip
          variant="SurfaceVariant"
          radii="Pill"
          disabled={check.status === 'checking'}
          onClick={() => refresh(true)}
          title="Fetch the runner's copy again and show what changed"
          before={<Icon size="50" src={Icons.Reload} />}
        >
          <Text size="B300">{check.status === 'checking' ? 'Comparing...' : 'Compare Again'}</Text>
        </Chip>
        {projects && projects.length > 0 && (
          <select
            value=""
            disabled={opening}
            onChange={(e) => openFromRunner(e.target.value)}
            aria-label="Open a project from the runner"
            style={{
              padding: config.space.S100,
              borderRadius: config.radii.R300,
              background: color.Secondary.Container,
              color: color.Secondary.OnContainer,
              border: `1px solid ${color.Secondary.ContainerLine}`,
            }}
          >
            <option value="">{opening ? 'Opening...' : 'Open from Runner'}</option>
            {projects.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        )}
      </Box>
      {openError && (
        <Text size="T200" style={{ color: color.Critical.Main }}>
          {openError}
        </Text>
      )}
      {open && differs && (
        <DiffReview
          changes={changes}
          remoteName="Runner"
          onTakeRemote={(picked: Change[]) => onReplaceFiles(takeRemote(files, picked, root))}
          actions={
            <Chip variant="Primary" radii="Pill" disabled={!save} onClick={() => save?.()}>
              <Text size="B300">Send Mine to Runner</Text>
            </Chip>
          }
        />
      )}
    </Box>
  );
}

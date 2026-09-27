import React, { lazy, ReactNode, Suspense, useEffect, useState } from 'react';
import { Box, Chip, color, config, Icon, Icons, Text, toRem } from 'folds';
import { ResizeHandle } from '../../components/resize-handle';
import { ScreenSize, useScreenSizeContext } from '../../hooks/useScreenSize';
import { Change, ChangeKind } from './diff';
import { LoadingQuips } from './LoadingQuips';

const DiffView = lazy(() => import('./DiffView'));

function KindBadge({ kind, remoteName }: { kind: ChangeKind; remoteName: string }) {
  const tone = {
    changed: color.Warning.Main,
    local: color.Success.Main,
    remote: color.Primary.Main,
  }[kind];
  const label = { changed: 'Changed', local: 'Only here', remote: `Only on ${remoteName}` }[kind];
  return (
    <Text
      as="span"
      size="L400"
      style={{
        color: tone,
        border: `1px solid ${tone}`,
        borderRadius: config.radii.Pill,
        padding: `0 ${config.space.S100}`,
        flexShrink: 0,
      }}
    >
      {label}
    </Text>
  );
}

const LIST_WIDTH_KEY = 'angaara.diffListWidth';
const HEIGHT_KEY = 'angaara.diffHeight';
const loadNumber = (key: string, fallback: number) => {
  try {
    const value = Number(localStorage.getItem(key));
    return Number.isFinite(value) && value > 0 ? value : fallback;
  } catch {
    return fallback;
  }
};
const saveNumber = (key: string, value: number) => {
  try {
    localStorage.setItem(key, String(value));
  } catch {
    // Size just isn't remembered when storage is blocked.
  }
};

type DiffReviewProps = {
  changes: Change[];
  // Short name for the other side, like "runner" or "main".
  remoteName: string;
  onTakeRemote: (picked: Change[]) => void;
  // Extra buttons for the toolbar, like sending local files the other way.
  actions?: ReactNode;
};
// GitHub-style review: file list on the left, side-by-side diff on the right.
export function DiffReview({ changes, remoteName, onTakeRemote, actions }: DiffReviewProps) {
  const [selected, setSelected] = useState<string>();
  const [fullScreen, setFullScreen] = useState(false);
  const [listWidth, setListWidth] = useState(() => loadNumber(LIST_WIDTH_KEY, 260));
  const [height, setHeight] = useState(() => loadNumber(HEIGHT_KEY, 520));
  const current = changes.find((c) => c.path === selected) ?? changes[0];
  // Phones stack the file list above the diff instead of beside it.
  const mobile = useScreenSizeContext() === ScreenSize.Mobile;

  // Nothing left to review (e.g. everything was taken): leave full screen.
  const hasChanges = changes.length > 0;
  useEffect(() => {
    if (!hasChanges) setFullScreen(false);
  }, [hasChanges]);

  useEffect(() => {
    if (!fullScreen) return undefined;
    // Monaco marks keys it handles, so Esc only exits otherwise.
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !e.defaultPrevented) setFullScreen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [fullScreen]);

  if (!current) return null;

  return (
    <Box
      direction="Column"
      gap="200"
      style={
        fullScreen
          ? {
              position: 'fixed',
              inset: 0,
              zIndex: 1000,
              padding: config.space.S400,
              background: color.Background.Container,
              color: color.Background.OnContainer,
            }
          : undefined
      }
    >
      <Box gap="200" wrap="Wrap" alignItems="Center">
        <Text size="T200" priority="300">
          Left: {remoteName}. Right: this browser.
        </Text>
        <Box grow="Yes" />
        <Chip variant="SurfaceVariant" radii="Pill" onClick={() => onTakeRemote(changes)}>
          <Text size="B300">Use All From {remoteName}</Text>
        </Chip>
        {actions}
        <Chip
          variant="SurfaceVariant"
          radii="Pill"
          onClick={() => setFullScreen((v) => !v)}
          before={<Icon size="50" src={fullScreen ? Icons.Cross : Icons.Monitor} />}
        >
          <Text size="B300">{fullScreen ? 'Exit Full Screen' : 'Full Screen'}</Text>
        </Chip>
      </Box>
      <Box
        direction={mobile ? 'Column' : 'Row'}
        gap={mobile ? '200' : undefined}
        style={fullScreen ? { flexGrow: 1, minHeight: 0 } : { height: toRem(height) }}
      >
        <Box
          direction="Column"
          gap="100"
          style={{
            width: mobile ? '100%' : toRem(listWidth),
            maxHeight: mobile ? toRem(150) : undefined,
            flexShrink: 0,
            overflowY: 'auto',
          }}
        >
          {changes.map((c) => (
            <Box
              key={c.path}
              as="button"
              type="button"
              onClick={() => setSelected(c.path)}
              direction="Column"
              gap="100"
              style={{
                textAlign: 'left',
                flexShrink: 0,
                padding: config.space.S200,
                borderRadius: config.radii.R300,
                border: 'none',
                cursor: 'pointer',
                color: 'inherit',
                background: c.path === current.path ? color.Surface.ContainerActive : 'transparent',
              }}
            >
              <Text size="T200" style={{ wordBreak: 'break-all' }}>
                {c.path}
              </Text>
              <KindBadge kind={c.kind} remoteName={remoteName} />
            </Box>
          ))}
        </Box>
        {!mobile && (
          <ResizeHandle
            axis="x"
            label="Resize file list"
            value={listWidth}
            min={140}
            max={Math.max(180, Math.round(window.innerWidth * 0.4))}
            onChange={(w) => {
              setListWidth(w);
              saveNumber(LIST_WIDTH_KEY, w);
            }}
          />
        )}
        <Box direction="Column" gap="200" grow="Yes" style={{ minWidth: 0, minHeight: 0 }}>
          <Box gap="200" alignItems="Center" wrap="Wrap">
            <Text size="T300" style={{ wordBreak: 'break-all' }}>
              {current.path}
            </Text>
            <Box grow="Yes" />
            <Chip variant="SurfaceVariant" radii="Pill" onClick={() => onTakeRemote([current])}>
              <Text size="B300">
                {current.kind === 'local' ? 'Remove Here' : `Use ${remoteName}'s Version`}
              </Text>
            </Chip>
          </Box>
          <Box
            grow="Yes"
            style={{
              minHeight: 0,
              borderRadius: config.radii.R300,
              overflow: 'hidden',
              border: `1px solid ${color.Background.ContainerLine}`,
            }}
          >
            <Suspense fallback={<LoadingQuips />}>
              <DiffView
                path={current.path}
                remote={current.remote ?? ''}
                local={current.local ?? ''}
              />
            </Suspense>
          </Box>
        </Box>
      </Box>
      {!fullScreen && (
        <ResizeHandle
          axis="y"
          label="Resize diff"
          value={height}
          min={240}
          max={Math.max(320, Math.round(window.innerHeight * 1.5))}
          onChange={(h) => {
            setHeight(h);
            saveNumber(HEIGHT_KEY, h);
          }}
        />
      )}
    </Box>
  );
}

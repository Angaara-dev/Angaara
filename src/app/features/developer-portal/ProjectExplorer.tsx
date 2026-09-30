import React, {
  DragEvent,
  ReactNode,
  Suspense,
  lazy,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import FileSaver from 'file-saver';
import { Box, Button, Chip, Icon, IconButton, Icons, Text, color, config, toRem } from 'folds';
import { makeZip, ZipFile } from '../../utils/zip';
import { CopyChip } from './CodeBlock';
import { AiChat } from './AiChat';
import { LoadingQuips } from './LoadingQuips';
import { DroppedItems, itemsFromDrop } from './importFolder';
import { ResizeHandle } from '../../components/resize-handle';
import { ScreenSize, useScreenSizeContext } from '../../hooks/useScreenSize';
import { fileTypeOf } from './fileTypes';

type TreeNode = { name: string; path: string; children?: TreeNode[] };

const buildTree = (files: ZipFile[]): TreeNode[] => {
  const root: TreeNode = { name: '', path: '', children: [] };
  files.forEach((file) => {
    const parts = file.path.split('/');
    let node = root;
    parts.forEach((part, i) => {
      const path = parts.slice(0, i + 1).join('/');
      const isFile = i === parts.length - 1;
      let child = node.children?.find((c) => c.name === part);
      if (!child) {
        child = isFile ? { name: part, path } : { name: part, path, children: [] };
        node.children?.push(child);
      }
      node = child;
    });
  });
  const sort = (nodes: TreeNode[]): TreeNode[] =>
    nodes
      .map((n) => (n.children ? { ...n, children: sort(n.children) } : n))
      .sort((a, b) => Number(!!b.children) - Number(!!a.children) || a.name.localeCompare(b.name));
  return sort(root.children ?? []);
};

const folderPaths = (nodes: TreeNode[]): string[] =>
  nodes.flatMap((n) => (n.children ? [n.path, ...folderPaths(n.children)] : []));

const LINE = `1px solid ${color.SurfaceVariant.ContainerLine}`;
const MONO = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';

function FileBadge({ path }: { path: string }) {
  const { badge, color: tint } = fileTypeOf(path);
  return (
    <span
      aria-hidden
      style={{
        width: toRem(18),
        flexShrink: 0,
        textAlign: 'center',
        fontFamily: MONO,
        fontSize: '0.65rem',
        fontWeight: 700,
        color: tint,
      }}
    >
      {badge}
    </span>
  );
}

type TreeProps = {
  nodes: TreeNode[];
  selected: string;
  collapsed: Set<string>;
  onSelect: (path: string) => void;
  onToggle: (path: string) => void;
};
function Tree({ nodes, selected, collapsed, onSelect, onToggle }: TreeProps) {
  return (
    <>
      {nodes.map((node) => {
        const folder = !!node.children;
        const open = folder && !collapsed.has(node.path);
        const active = node.path === selected;
        return (
          <React.Fragment key={node.path}>
            <Box
              as="button"
              type="button"
              alignItems="Center"
              gap="100"
              onClick={() => (folder ? onToggle(node.path) : onSelect(node.path))}
              style={{
                padding: `${toRem(3)} ${config.space.S200}`,
                borderRadius: config.radii.R300,
                background: active ? color.Primary.Container : 'transparent',
                color: active ? color.Primary.Main : color.Surface.OnContainer,
                border: 'none',
                cursor: 'pointer',
                width: '100%',
                textAlign: 'left',
              }}
            >
              {folder ? (
                <Icon size="50" src={open ? Icons.ChevronBottom : Icons.ChevronRight} />
              ) : (
                <FileBadge path={node.path} />
              )}
              <Text as="span" size="T300" truncate>
                {node.name}
              </Text>
            </Box>
            {open && node.children && (
              <div style={{ marginLeft: toRem(14), paddingLeft: toRem(2), borderLeft: LINE }}>
                <Tree
                  nodes={node.children}
                  selected={selected}
                  collapsed={collapsed}
                  onSelect={onSelect}
                  onToggle={onToggle}
                />
              </div>
            )}
          </React.Fragment>
        );
      })}
    </>
  );
}

const CodeEditor = lazy(() => import('./CodeEditor'));

const SIZE_KEY = 'hearth.devtools.chatSize';
const loadChatSize = (): { width: number; height: number } => {
  const fallback = { width: 440, height: 560 };
  try {
    const saved = JSON.parse(localStorage.getItem(SIZE_KEY) ?? '{}');
    return {
      width: typeof saved.width === 'number' ? saved.width : fallback.width,
      height: typeof saved.height === 'number' ? saved.height : fallback.height,
    };
  } catch {
    return fallback;
  }
};

const TREE_WIDTH_KEY = 'hearth.devtools.treeWidth';
const loadTreeWidth = (): number => {
  try {
    const saved = Number(localStorage.getItem(TREE_WIDTH_KEY));
    return saved > 0 ? saved : 220;
  } catch {
    return 220;
  }
};

const PANEL_HEIGHT_KEY = 'hearth.devtools.panelHeight';
const loadPanelHeight = (): number => {
  try {
    const saved = Number(localStorage.getItem(PANEL_HEIGHT_KEY));
    return saved > 0 ? saved : 260;
  } catch {
    return 260;
  }
};

type ProjectExplorerProps = {
  files: ZipFile[];
  zipName: string;
  initialFile: string;
  initiallyCollapsed?: string[];
  onChange?: (path: string, content: string) => void;
  // Enables the AI review chat; files under this folder are sent as SDK context.
  sdkPrefix?: string;
  onDropItems?: (items: DroppedItems) => void;
  actions?: ReactNode;
  panel?: ReactNode;
  status?: ReactNode;
  // Files with changes not yet saved; their tabs get a dot.
  dirtyPaths?: Set<string>;
};
export function ProjectExplorer({
  files,
  zipName,
  initialFile,
  initiallyCollapsed = [],
  onChange,
  sdkPrefix,
  onDropItems,
  actions,
  panel,
  status,
  dirtyPaths,
}: ProjectExplorerProps) {
  const tree = useMemo(() => buildTree(files), [files]);
  const [selected, setSelected] = useState(initialFile);
  const [collapsed, setCollapsed] = useState(() => new Set(initiallyCollapsed));
  const [fullScreen, setFullScreen] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [chatSize, setChatSize] = useState(loadChatSize);
  const [treeWidth, setTreeWidth] = useState(loadTreeWidth);
  const [panelHeight, setPanelHeight] = useState(loadPanelHeight);
  const [tabs, setTabs] = useState<string[]>(() => [initialFile]);
  const [cursor, setCursor] = useState({ line: 1, column: 1 });
  const file = files.find((f) => f.path === selected);
  const mobile = useScreenSizeContext() === ScreenSize.Mobile;
  // The frame keeps a fixed height; dragging only moves the editor/terminal split.
  const frameHeight = (mobile ? 560 : 540) + (panel ? 260 : 0);
  const panelMax = Math.max(160, (fullScreen ? window.innerHeight : frameHeight) - 240);
  const shownPanelHeight = Math.min(panelHeight, panelMax);
  const [treeOpen, setTreeOpen] = useState(false);
  const selectFile = (path: string) => {
    setSelected(path);
    setTabs((t) => (t.includes(path) ? t : [...t, path]));
    if (mobile) setTreeOpen(false);
  };
  const shownTabs = useMemo(() => {
    const open = tabs.filter((path) => files.some((f) => f.path === path));
    if (file && !open.includes(file.path)) open.push(file.path);
    return open;
  }, [tabs, files, file]);
  const closeTab = (path: string) => {
    const index = shownTabs.indexOf(path);
    if (path === selected) setSelected(shownTabs[index + 1] ?? shownTabs[index - 1] ?? '');
    setTabs((t) => t.filter((p) => p !== path));
  };
  const handleCursor = useCallback(
    (line: number, column: number) => setCursor({ line, column }),
    []
  );

  // A new project was opened, or the selected file is gone: jump to the project's main file.
  useEffect(() => {
    setSelected(initialFile);
    setTabs([initialFile]);
  }, [initialFile]);
  const selectedExists = !!file;
  useEffect(() => {
    if (!selectedExists) setSelected(initialFile);
  }, [selectedExists, initialFile]);

  const resizeChat = (change: Partial<{ width: number; height: number }>) =>
    setChatSize((prev) => {
      const next = { ...prev, ...change };
      try {
        localStorage.setItem(SIZE_KEY, JSON.stringify(next));
      } catch {
        // Size just isn't remembered when storage is blocked.
      }
      return next;
    });

  const resizePanel = (height: number) => {
    setPanelHeight(height);
    try {
      localStorage.setItem(PANEL_HEIGHT_KEY, String(height));
    } catch {
      // Height just isn't remembered when storage is blocked.
    }
  };

  const resizeTree = (width: number) => {
    setTreeWidth(width);
    try {
      localStorage.setItem(TREE_WIDTH_KEY, String(width));
    } catch {
      // Width just isn't remembered when storage is blocked.
    }
  };

  // Capture phase, so Monaco doesn't paste a dropped file's text into the open file.
  const hasFiles = (evt: DragEvent) => evt.dataTransfer.types.includes('Files');
  const dropHandlers = onDropItems && {
    onDragOverCapture: (evt: DragEvent) => {
      if (!hasFiles(evt)) return;
      evt.preventDefault();
      evt.stopPropagation();
      setDragging(true);
    },
    onDragLeave: (evt: DragEvent) => {
      if (!evt.currentTarget.contains(evt.relatedTarget as Node | null)) setDragging(false);
    },
    onDropCapture: (evt: DragEvent) => {
      if (!hasFiles(evt)) return;
      evt.preventDefault();
      evt.stopPropagation();
      setDragging(false);
      onDropItems(itemsFromDrop(evt.dataTransfer));
    },
  };

  useEffect(() => {
    if (!fullScreen) return undefined;
    // Monaco marks keys it handles (like dismissing a suggestion), so Esc only exits otherwise.
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !e.defaultPrevented) setFullScreen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [fullScreen]);

  const toggle = (path: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });

  const handleEdit = useCallback(
    (content: string) => {
      if (file) onChange?.(file.path, content);
    },
    [file, onChange]
  );

  const explorer = (
    <Box
      direction="Column"
      gap="300"
      {...dropHandlers}
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
          : { position: 'relative' }
      }
    >
      {dragging && (
        <Box
          alignItems="Center"
          justifyContent="Center"
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 1,
            pointerEvents: 'none',
            borderRadius: config.radii.R400,
            border: `2px dashed ${color.Primary.Main}`,
            background: color.Primary.Container,
            opacity: 0.92,
          }}
        >
          <Text size="H5" style={{ color: color.Primary.OnContainer }}>
            Drop a folder to open it, or files to add them
          </Text>
        </Box>
      )}
      <Box gap="200" alignItems="Center" wrap="Wrap">
        <Button
          size="300"
          variant="Primary"
          radii="300"
          before={<Icon size="100" src={Icons.Download} />}
          onClick={() => FileSaver.saveAs(makeZip(files), zipName)}
        >
          <Text size="B300">Download .zip</Text>
        </Button>
        {actions}
        <Box grow="Yes" />
        {sdkPrefix && (
          <Chip
            variant={showChat ? 'Primary' : 'SurfaceVariant'}
            radii="Pill"
            aria-pressed={showChat}
            onClick={() => setShowChat((v) => !v)}
            before={<Icon size="50" src={Icons.Message} />}
          >
            <Text size="B300">AI Review</Text>
          </Chip>
        )}
        <Chip
          variant="SurfaceVariant"
          radii="Pill"
          onClick={() => setFullScreen((v) => !v)}
          before={<Icon size="50" src={fullScreen ? Icons.Cross : Icons.Monitor} />}
        >
          <Text size="B300">{fullScreen ? 'Exit Full Screen (Esc)' : 'Full Screen'}</Text>
        </Chip>
      </Box>
      <Box
        direction="Column"
        grow={fullScreen ? 'Yes' : undefined}
        style={{
          height: fullScreen ? undefined : toRem(frameHeight),
          minHeight: 0,
          borderRadius: config.radii.R400,
          border: LINE,
          overflow: 'hidden',
        }}
      >
        <Box direction={mobile ? 'Column' : 'Row'} grow="Yes" style={{ minHeight: 0 }}>
          {mobile && (
            <Box
              as="button"
              type="button"
              onClick={() => setTreeOpen((v) => !v)}
              aria-expanded={treeOpen}
              alignItems="Center"
              gap="200"
              shrink="No"
              style={{
                padding: config.space.S300,
                border: 'none',
                borderBottom: LINE,
                background: color.Surface.Container,
                color: 'inherit',
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              <Icon size="100" src={Icons.Category} />
              <Text size="T300" truncate style={{ flexGrow: 1 }}>
                {selected.split('/').pop() || 'Files'}
              </Text>
              <Icon size="100" src={treeOpen ? Icons.ChevronTop : Icons.ChevronBottom} />
            </Box>
          )}
          {(!mobile || treeOpen) && (
            <Box
              direction="Column"
              shrink="No"
              style={{
                width: mobile ? '100%' : toRem(treeWidth),
                maxHeight: mobile ? '45%' : undefined,
                background: color.Surface.Container,
                borderBottom: mobile ? LINE : undefined,
              }}
            >
              <Box
                alignItems="Center"
                justifyContent="SpaceBetween"
                shrink="No"
                style={{
                  padding: `${config.space.S100} ${config.space.S100} 0 ${config.space.S300}`,
                }}
              >
                <Text
                  size="L400"
                  priority="300"
                  style={{ fontSize: '0.7rem', letterSpacing: '0.08em' }}
                >
                  EXPLORER
                </Text>
                <IconButton
                  size="300"
                  radii="300"
                  variant="Surface"
                  aria-label="Collapse all folders"
                  title="Collapse all folders"
                  onClick={() => setCollapsed(new Set(folderPaths(tree)))}
                >
                  <Icon size="50" src={Icons.ChevronTop} />
                </IconButton>
              </Box>
              <Box
                direction="Column"
                grow="Yes"
                style={{
                  overflowY: 'auto',
                  padding: `0 ${config.space.S200} ${config.space.S200}`,
                }}
              >
                <Tree
                  nodes={tree}
                  selected={selected}
                  collapsed={collapsed}
                  onSelect={selectFile}
                  onToggle={toggle}
                />
              </Box>
            </Box>
          )}
          {!mobile && (
            <ResizeHandle
              axis="x"
              label="Resize file tree"
              value={treeWidth}
              min={120}
              max={Math.max(160, Math.round(window.innerWidth * 0.5))}
              onChange={resizeTree}
            />
          )}
          <Box
            direction="Column"
            grow="Yes"
            style={{ minWidth: 0, minHeight: 0, background: color.Background.Container }}
          >
            <Box
              alignItems="Stretch"
              shrink="No"
              style={{ background: color.Surface.Container, borderBottom: LINE }}
            >
              <Box role="tablist" grow="Yes" style={{ overflowX: 'auto', minWidth: 0 }}>
                {shownTabs.map((path) => {
                  const active = path === selected;
                  const dirty = dirtyPaths?.has(path);
                  return (
                    <Box
                      key={path}
                      alignItems="Center"
                      shrink="No"
                      style={{
                        borderRight: LINE,
                        borderTop: `2px solid ${active ? color.Primary.Main : 'transparent'}`,
                        background: active ? color.Background.Container : 'transparent',
                        color: active ? color.Background.OnContainer : color.Surface.OnContainer,
                        opacity: active ? 1 : 0.7,
                      }}
                    >
                      <Box
                        as="button"
                        type="button"
                        role="tab"
                        aria-selected={active}
                        title={path}
                        alignItems="Center"
                        gap="100"
                        onClick={() => setSelected(path)}
                        style={{
                          padding: `${config.space.S200} ${config.space.S100} ${config.space.S200} ${config.space.S300}`,
                          background: 'transparent',
                          border: 'none',
                          color: 'inherit',
                          cursor: 'pointer',
                        }}
                      >
                        <FileBadge path={path} />
                        <Text as="span" size="T300">
                          {path.split('/').pop()}
                        </Text>
                        {dirty && (
                          <span
                            aria-label="Unsaved changes"
                            style={{
                              width: toRem(7),
                              height: toRem(7),
                              borderRadius: '50%',
                              background: color.Primary.Main,
                            }}
                          />
                        )}
                      </Box>
                      {shownTabs.length > 1 ? (
                        <IconButton
                          size="300"
                          radii="300"
                          variant="Surface"
                          aria-label={`Close ${path.split('/').pop()}`}
                          onClick={() => closeTab(path)}
                          style={{ marginRight: config.space.S100 }}
                        >
                          <Icon size="50" src={Icons.Cross} />
                        </IconButton>
                      ) : (
                        <span style={{ width: config.space.S200 }} />
                      )}
                    </Box>
                  );
                })}
              </Box>
              {file && (
                <Box alignItems="Center" shrink="No" style={{ padding: `0 ${config.space.S200}` }}>
                  <CopyChip value={file.content} label="Copy File" />
                </Box>
              )}
            </Box>
            <Box
              alignItems="Center"
              gap="100"
              shrink="No"
              style={{ padding: `${config.space.S100} ${config.space.S300}`, minWidth: 0 }}
            >
              <Text size="T200" priority="300" truncate>
                {selected.split('/').join('  ›  ')}
              </Text>
            </Box>
            <Box grow="Yes" style={{ minHeight: 0 }}>
              {file ? (
                <Suspense fallback={<LoadingQuips />}>
                  <CodeEditor
                    path={file.path}
                    value={file.content}
                    onChange={onChange ? handleEdit : undefined}
                    onCursorChange={handleCursor}
                  />
                </Suspense>
              ) : (
                <Text size="T300" priority="300" style={{ padding: config.space.S300 }}>
                  Select a file
                </Text>
              )}
            </Box>
            {panel && (
              <>
                <ResizeHandle
                  axis="y"
                  invert
                  label="Resize terminal"
                  value={shownPanelHeight}
                  min={120}
                  max={panelMax}
                  onChange={resizePanel}
                />
                <Box
                  direction="Column"
                  shrink="No"
                  style={{ height: toRem(shownPanelHeight), minHeight: 0, borderTop: LINE }}
                >
                  {panel}
                </Box>
              </>
            )}
          </Box>
          {showChat && fullScreen && sdkPrefix && !mobile && (
            <ResizeHandle
              axis="x"
              invert
              label="Resize AI chat"
              value={chatSize.width}
              min={300}
              max={Math.max(320, Math.round(window.innerWidth * 0.7))}
              onChange={(width) => resizeChat({ width })}
            />
          )}
          {showChat && fullScreen && sdkPrefix && !mobile && (
            <Box
              direction="Column"
              shrink="No"
              style={{ width: toRem(chatSize.width), borderLeft: LINE }}
            >
              <AiChat files={files} openFile={file?.path} sdkPrefix={sdkPrefix} />
            </Box>
          )}
        </Box>
        <Box
          alignItems="Center"
          gap="400"
          shrink="No"
          style={{
            padding: `${toRem(3)} ${config.space.S300}`,
            background: color.Surface.Container,
            borderTop: LINE,
            overflow: 'hidden',
            whiteSpace: 'nowrap',
          }}
        >
          {status}
          <Box grow="Yes" />
          {file && (
            <Text size="T200" priority="300">
              Ln {cursor.line}, Col {cursor.column}
            </Text>
          )}
          {!mobile && (
            <>
              <Text size="T200" priority="300">
                Spaces: 4
              </Text>
              <Text size="T200" priority="300">
                UTF-8
              </Text>
              <Text size="T200" priority="300">
                {files.length} files
              </Text>
            </>
          )}
          {file && (
            <Text size="T200" priority="300">
              {fileTypeOf(file.path).label}
            </Text>
          )}
        </Box>
      </Box>
      {showChat && (!fullScreen || mobile) && sdkPrefix && (
        <Box
          direction="Column"
          style={{
            height: toRem(chatSize.height),
            borderRadius: config.radii.R400,
            border: LINE,
            overflow: 'hidden',
          }}
        >
          <AiChat files={files} openFile={file?.path} sdkPrefix={sdkPrefix} />
        </Box>
      )}
      {showChat && !fullScreen && sdkPrefix && (
        <ResizeHandle
          axis="y"
          label="Resize AI chat"
          value={chatSize.height}
          min={300}
          max={1200}
          onChange={(height) => resizeChat({ height })}
        />
      )}
    </Box>
  );

  return fullScreen ? createPortal(explorer, document.body) : explorer;
}

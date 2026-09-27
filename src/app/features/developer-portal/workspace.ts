import { atom } from 'jotai';
import { ZipFile } from '../../utils/zip';
import { STARTER_FILES, STARTER_ROOT } from './starterProject';

// The GitHub branch a workspace was pulled from, so commits and diffs know where to go.
export type WorkspaceRepo = { owner: string; repo: string; branch: string };
export type Workspace = {
  root: string;
  files: ZipFile[];
  starter: boolean;
  github?: WorkspaceRepo;
};
export const STARTER_WORKSPACE: Workspace = {
  root: STARTER_ROOT,
  files: STARTER_FILES,
  starter: true,
};
// Where the single workspace lived before projects; only read to bring it into a project.
const LEGACY_WORKSPACE_KEY = 'angaara.devWorkspace';
const SDK_PREFIX = `${STARTER_ROOT}/angaara-bot/`;

export const normalizeWorkspace = (saved: unknown): Workspace | undefined => {
  const ws = saved as Workspace | null;
  const valid =
    !!ws &&
    typeof ws.root === 'string' &&
    typeof ws.starter === 'boolean' &&
    Array.isArray(ws.files) &&
    ws.files.every((f: ZipFile) => typeof f?.path === 'string' && typeof f?.content === 'string');
  if (!ws || !valid) return undefined;
  if (!ws.starter) return ws;
  // The starter always gets the SDK from this version of Angaara, never a stale saved copy.
  const own = ws.files.filter((f) => !f.path.startsWith(SDK_PREFIX));
  const sdk = STARTER_FILES.filter((f) => f.path.startsWith(SDK_PREFIX));
  return { ...ws, files: [...own, ...sdk].sort((a, b) => a.path.localeCompare(b.path)) };
};

export const loadLegacyWorkspace = (): Workspace | undefined => {
  try {
    const ws = normalizeWorkspace(JSON.parse(localStorage.getItem(LEGACY_WORKSPACE_KEY) ?? 'null'));
    return ws && !ws.starter ? ws : undefined;
  } catch {
    return undefined;
  }
};
export const clearLegacyWorkspace = () => {
  try {
    localStorage.removeItem(LEGACY_WORKSPACE_KEY);
  } catch {
    // Storage blocked: nothing was kept there anyway.
  }
};

// The open project's files. useDevProjects loads it and saves every change to the account.
export const baseWorkspaceAtom = atom<Workspace>(STARTER_WORKSPACE);
export const workspaceAtom = atom(
  (get) => get(baseWorkspaceAtom),
  (get, set, update: Workspace | ((prev: Workspace) => Workspace)) => {
    set(baseWorkspaceAtom, typeof update === 'function' ? update(get(baseWorkspaceAtom)) : update);
  }
);

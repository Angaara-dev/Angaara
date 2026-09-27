import { ZipFile } from '../../utils/zip';

// The build cache and the bot's login never leave the runner, so they never count as changes.
const IGNORED_DIRS = ['target/', 'bot-data/'];

export type ChangeKind = 'changed' | 'local' | 'remote';
export type Change = { path: string; kind: ChangeKind; local?: string; remote?: string };

// Paths relative to the project folder, without the ignored folders.
export const byRelativePath = (files: ZipFile[], root: string) => {
  const prefix = `${root}/`;
  return new Map(
    files
      .filter((f) => f.path.startsWith(prefix))
      .map((f) => [f.path.slice(prefix.length), f.content] as const)
      .filter(([path]) => !IGNORED_DIRS.some((dir) => path.startsWith(dir)))
  );
};

export const diffFiles = (local: ZipFile[], remote: ZipFile[], root: string): Change[] => {
  const mine = byRelativePath(local, root);
  const theirs = byRelativePath(remote, root);
  const changes: Change[] = [];
  mine.forEach((content, path) => {
    const other = theirs.get(path);
    if (other === undefined) changes.push({ path, kind: 'local', local: content });
    else if (other !== content)
      changes.push({ path, kind: 'changed', local: content, remote: other });
  });
  theirs.forEach((content, path) => {
    if (!mine.has(path)) changes.push({ path, kind: 'remote', remote: content });
  });
  return changes.sort((a, b) => a.path.localeCompare(b.path));
};

// Applies the remote side of the picked changes to the local files.
export const takeRemote = (files: ZipFile[], picked: Change[], root: string): ZipFile[] => {
  const drop = new Set(picked.filter((c) => c.kind === 'local').map((c) => `${root}/${c.path}`));
  const replace = new Map(
    picked
      .filter((c) => c.remote !== undefined)
      .map((c) => [`${root}/${c.path}`, c.remote as string])
  );
  const next = files
    .filter((f) => !drop.has(f.path))
    .map((f) => (replace.has(f.path) ? { ...f, content: replace.get(f.path) as string } : f));
  replace.forEach((content, path) => {
    if (!next.some((f) => f.path === path)) next.push({ path, content });
  });
  return next.sort((a, b) => a.path.localeCompare(b.path));
};

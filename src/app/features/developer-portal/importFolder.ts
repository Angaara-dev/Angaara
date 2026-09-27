import { ZipFile } from '../../utils/zip';

// Matches angaara-runner's bundle limits, so anything imported can still be built.
export const IMPORT_LIMITS = {
  maxFiles: 500,
  maxFileBytes: 2 * 1024 * 1024,
  maxTotalBytes: 20 * 1024 * 1024,
};

// Build output, dependencies and VCS data: huge, regenerated, and not worth editing here.
const SKIP_DIRS = new Set([
  '.git',
  'node_modules',
  'target',
  'dist',
  'build',
  '.idea',
  '.vs',
  '.next',
  '__pycache__',
  '.venv',
  'venv',
]);

export type PickedFile = { path: string; file: File };
// Folder entries where the browser supports them, plus plain files as a fallback.
export type DroppedItems = { entries: FileSystemEntry[]; files: File[] };

const skipPath = (path: string) => path.split('/').some((part) => SKIP_DIRS.has(part));

// Read synchronously: DataTransfer items are cleared once the drop handler returns.
export const itemsFromDrop = (data: DataTransfer): DroppedItems => ({
  entries: Array.from(data.items)
    .filter((item) => item.kind === 'file')
    .map((item) => item.webkitGetAsEntry())
    .filter((entry): entry is FileSystemEntry => !!entry),
  files: Array.from(data.files),
});

const readBatch = (reader: FileSystemDirectoryReader) =>
  new Promise<FileSystemEntry[]>((resolve, reject) => {
    reader.readEntries(resolve, reject);
  });

// readEntries returns at most ~100 entries per call, so keep reading until it's empty.
const readAll = async (reader: FileSystemDirectoryReader): Promise<FileSystemEntry[]> => {
  const batch = await readBatch(reader);
  return batch.length === 0 ? [] : [...batch, ...(await readAll(reader))];
};

const walk = async (entry: FileSystemEntry): Promise<PickedFile[]> => {
  const path = entry.fullPath.replace(/^\//, '');
  if (entry.isFile) {
    const file = await new Promise<File>((resolve, reject) => {
      (entry as FileSystemFileEntry).file(resolve, reject);
    });
    return [{ path, file }];
  }
  if (!entry.isDirectory || SKIP_DIRS.has(entry.name)) return [];
  const children = await readAll((entry as FileSystemDirectoryEntry).createReader());
  return (await Promise.all(children.map(walk))).flat();
};

export const pickedFromEntries = async (entries: FileSystemEntry[]): Promise<PickedFile[]> =>
  (await Promise.all(entries.map(walk))).flat();

// From <input type="file">; folder picks carry webkitRelativePath ("folder/src/main.rs").
export const pickedFromInput = (list: ArrayLike<File>): PickedFile[] =>
  Array.from(list)
    .map((file) => ({ path: file.webkitRelativePath || file.name, file }))
    .filter((picked) => !skipPath(picked.path));

// Runner project names become directories, so only lowercase letters, digits, - and _.
export const toProjectName = (name: string): string =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^[^a-z0-9]+/, '')
    .slice(0, 64)
    .replace(/[-_]+$/, '') || 'my-project';

export type ImportResult = {
  // Set when the pick was one folder, which becomes the whole workspace.
  root?: string;
  files: ZipFile[];
  skipped: { binary: number; tooBig: number; overLimit: number };
};

const decoder = new TextDecoder('utf-8', { fatal: true });

const readText = async (file: File): Promise<string | undefined> => {
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (bytes.subarray(0, 8000).includes(0)) return undefined;
  try {
    return decoder.decode(bytes);
  } catch {
    return undefined;
  }
};

export const readPicked = async (picked: PickedFile[]): Promise<ImportResult> => {
  const tops = new Set(picked.map((p) => p.path.split('/')[0]));
  const isFolder = tops.size === 1 && picked.every((p) => p.path.includes('/'));
  const root = isFolder ? toProjectName([...tops][0]) : undefined;

  const skipped = { binary: 0, tooBig: 0, overLimit: 0 };
  let total = 0;
  let count = 0;
  const chosen = [...picked]
    .sort((a, b) => a.path.localeCompare(b.path))
    .filter(({ file }) => {
      if (file.size > IMPORT_LIMITS.maxFileBytes) {
        skipped.tooBig += 1;
        return false;
      }
      if (count >= IMPORT_LIMITS.maxFiles || total + file.size > IMPORT_LIMITS.maxTotalBytes) {
        skipped.overLimit += 1;
        return false;
      }
      count += 1;
      total += file.size;
      return true;
    });

  const read = await Promise.all(
    chosen.map(async ({ path, file }) => {
      const content = await readText(file);
      if (content === undefined) {
        skipped.binary += 1;
        return undefined;
      }
      const rest = path.split('/').slice(1).join('/');
      return { path: root ? `${root}/${rest}` : path, content };
    })
  );
  return { root, files: read.filter((f): f is ZipFile => !!f), skipped };
};

export const describeSkipped = ({ binary, tooBig, overLimit }: ImportResult['skipped']) =>
  [
    binary && `${binary} binary`,
    tooBig && `${tooBig} over 2 MB`,
    overLimit && `${overLimit} past the 500 file / 20 MB limit`,
  ]
    .filter(Boolean)
    .join(', ');

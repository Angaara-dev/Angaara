import { useSyncExternalStore } from 'react';
import { MatrixClient } from 'matrix-js-sdk';
import { getVaultItem, subscribeVault, updateVaultItem, vaultReady } from '../../../client/vault';
import { isPrivateMode } from '../../utils/privateMode';
import { checkFile, FileReport } from './fileCheck';

export type FileScan = {
  id: string;
  // The file's mxc URL, so checking the same file again reuses its scan.
  key?: string;
  name: string;
  at: number;
  status: 'scanning' | 'done' | 'failed';
  report?: FileReport;
  error?: string;
};

type Source = { name: string; key?: string; getFile: () => Promise<Blob> };

// Finished scans sync through the encrypted vault in your Matrix account data. Until the vault
// is open on this device they're kept in localStorage and moved over once it is.
const MAX_KEPT = 40;
const MAX_SYNC_CHARS = 60000;

let owner: string | undefined;
let local: FileScan[] = [];
let active: FileScan[] = [];
let snapshot: FileScan[] = [];
const listeners = new Set<() => void>();
const running = new Map<string, AbortController>();

const storageKey = (userId: string) => `angaaraFileScans:${userId}`;

const clean = (value: unknown): FileScan[] =>
  Array.isArray(value)
    ? value.filter(
        (s): s is FileScan =>
          !!s && typeof s === 'object' && typeof s.id === 'string' && s.status === 'done'
      )
    : [];

// Trims each report and drops the oldest scans so the list fits in one account data event.
const fit = (scans: FileScan[]): FileScan[] => {
  const out = scans.slice(0, MAX_KEPT).map((s) =>
    s.report
      ? {
          ...s,
          report: {
            ...s.report,
            commands: s.report.commands.slice(0, 5).map((c) => c.slice(0, 300)),
            links: s.report.links.slice(0, 10),
          },
        }
      : s
  );
  while (out.length > 1 && JSON.stringify(out).length > MAX_SYNC_CHARS) out.pop();
  return out;
};

const finished = () => (vaultReady() ? clean(getVaultItem('scans')) : local);

const saveLocal = () => {
  if (!owner) return;
  try {
    if (local.length > 0) localStorage.setItem(storageKey(owner), JSON.stringify(local));
    else localStorage.removeItem(storageKey(owner));
  } catch {
    // Storage full or blocked: the list just won't survive a reload.
  }
};

const refresh = () => {
  snapshot = [...active, ...finished()].sort((a, b) => b.at - a.at);
};
const emit = () => {
  refresh();
  listeners.forEach((l) => l());
};

const writeFinished = (change: (prev: FileScan[]) => FileScan[]) => {
  if (vaultReady()) {
    updateVaultItem<FileScan[]>('scans', (prev) => fit(change(clean(prev)))).catch(() => {
      local = fit(change(local));
      saveLocal();
      emit();
    });
  } else {
    local = fit(change(local));
    saveLocal();
  }
  emit();
};

// Moves scans made before the vault opened into it, so other devices see them too.
const moveLocalToVault = () => {
  if (!vaultReady() || local.length === 0) return;
  const moving = local;
  local = [];
  saveLocal();
  updateVaultItem<FileScan[]>('scans', (prev) => {
    const synced = clean(prev);
    const ids = new Set(synced.map((s) => s.id));
    return fit([...moving.filter((s) => !ids.has(s.id)), ...synced].sort((a, b) => b.at - a.at));
  }).catch(() => {
    local = moving;
    saveLocal();
  });
};

const load = (userId: string) => {
  if (owner === userId) return;
  if (owner === undefined) {
    subscribeVault(() => {
      moveLocalToVault();
      emit();
    });
  }
  owner = userId;
  active = [];
  try {
    local = clean(JSON.parse(localStorage.getItem(storageKey(userId)) ?? '[]'));
  } catch {
    local = [];
  }
  moveLocalToVault();
  // Called while rendering, so it only refreshes; listeners hear about later changes.
  refresh();
};

const patchActive = (id: string, change: Partial<FileScan>) => {
  active = active.map((s) => (s.id === id ? { ...s, ...change } : s));
  emit();
};

// Starts a scan that keeps going when its dialog closes, and returns its id.
export const startFileScan = (mx: MatrixClient, source: Source, again = false): string => {
  load(mx.getSafeUserId());
  const same = source.key ? snapshot.find((s) => s.key === source.key) : undefined;
  if (same && !again && same.status !== 'failed') return same.id;
  if (same) {
    running.get(same.id)?.abort();
    active = active.filter((s) => s.id !== same.id);
    if (same.status === 'done') writeFinished((prev) => prev.filter((s) => s.id !== same.id));
  }

  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const controller = new AbortController();
  running.set(id, controller);
  active = [
    { id, key: source.key, name: source.name, at: Date.now(), status: 'scanning' },
    ...active,
  ];
  emit();
  source
    .getFile()
    .then((blob) => checkFile(mx, source.name, blob, !isPrivateMode(), controller.signal))
    .then((report) => {
      const scan = active.find((s) => s.id === id);
      if (!scan) return;
      active = active.filter((s) => s.id !== id);
      writeFinished((prev) => [{ ...scan, status: 'done', report }, ...prev]);
    })
    .catch((e) => {
      if (controller.signal.aborted) return;
      patchActive(id, {
        status: 'failed',
        error: e instanceof Error ? e.message : "Couldn't check this file.",
      });
    })
    .finally(() => running.delete(id));
  return id;
};

export const removeFileScan = (id: string) => {
  running.get(id)?.abort();
  active = active.filter((s) => s.id !== id);
  if (finished().some((s) => s.id === id)) {
    writeFinished((prev) => prev.filter((s) => s.id !== id));
  } else {
    emit();
  }
};

export const clearFileScans = () => {
  active = active.filter((s) => s.status === 'scanning');
  writeFinished(() => []);
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const useFileScans = (mx: MatrixClient): FileScan[] => {
  load(mx.getSafeUserId());
  return useSyncExternalStore(subscribe, () => snapshot);
};

export const useScansSynced = (): boolean => useSyncExternalStore(subscribeVault, vaultReady);

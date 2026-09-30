import { useMemo } from 'react';
import { atom } from 'jotai';
import type { DevLock, Sealed } from './devCrypto';
import { useAccountData } from '../../hooks/useAccountData';

// Projects sync through Matrix account data: one small index, plus one event per project.
// Kept light (no crypto or starter files) so the sidebar can import it.
export const PROJECT_INDEX_TYPE = 'io.angaara.dev.projects';
export const projectEventType = (id: string) => `io.angaara.dev.project.${id}`;

export type ProjectMeta = { id: string; name: string; encrypted: boolean; created: number };
export type ProjectIndex = { lock?: DevLock; projects: ProjectMeta[] };
// Stored content: gzipped JSON, sealed with the dev key when the project is encrypted.
export type StoredProject = { v: 1; gz?: string; sealed?: Sealed };

export const isSealed = (s: unknown): s is Sealed =>
  !!s && typeof (s as Sealed).iv === 'string' && typeof (s as Sealed).ct === 'string';
const isLock = (l: unknown): l is DevLock => {
  const lock = l as DevLock;
  return (
    !!lock &&
    lock.v === 1 &&
    typeof lock.salt === 'string' &&
    Number.isInteger(lock.iterations) &&
    lock.iterations >= 100000 &&
    isSealed(lock.byPassword) &&
    isSealed(lock.byRecovery)
  );
};

export const readProjectIndex = (content: unknown): ProjectIndex => {
  const raw = (content ?? {}) as { lock?: unknown; projects?: unknown };
  const projects = Array.isArray(raw.projects)
    ? raw.projects.filter(
        (p): p is ProjectMeta =>
          typeof p?.id === 'string' &&
          /^[a-z0-9]{1,32}$/.test(p.id) &&
          typeof p?.name === 'string' &&
          typeof p?.encrypted === 'boolean'
      )
    : [];
  return { lock: isLock(raw.lock) ? raw.lock : undefined, projects };
};

export function useProjectIndex(): ProjectIndex {
  const event = useAccountData(PROJECT_INDEX_TYPE);
  return useMemo(() => readProjectIndex(event?.getContent()), [event]);
}

// The unlocked dev key for this session (also kept on this device by devCrypto).
export const devKeyAtom = atom<CryptoKey | undefined>(undefined);
export const devKeyCheckedAtom = atom(false);

const ACTIVE_KEY = 'angaara.devProject';
const loadActive = () => {
  try {
    return localStorage.getItem(ACTIVE_KEY) ?? undefined;
  } catch {
    return undefined;
  }
};
const baseActiveAtom = atom<string | undefined>(loadActive());
export const activeProjectIdAtom = atom(
  (get) => get(baseActiveAtom),
  (_get, set, id: string | undefined) => {
    set(baseActiveAtom, id);
    try {
      if (id) localStorage.setItem(ACTIVE_KEY, id);
      else localStorage.removeItem(ACTIVE_KEY);
    } catch {
      // Storage blocked: the first project opens after a reload.
    }
  }
);

export type ProjectStatus =
  | { status: 'loading' }
  | { status: 'none' }
  | { status: 'locked'; project: ProjectMeta }
  | { status: 'error'; project: ProjectMeta }
  | { status: 'ready'; project: ProjectMeta };
export const projectStatusAtom = atom<ProjectStatus>({ status: 'loading' });
export type SaveState = { state: 'saved' } | { state: 'saving' } | { state: 'error'; text: string };
export const saveStateAtom = atom<SaveState>({ state: 'saved' });

export type ProjectDialog =
  | { kind: 'new' }
  | { kind: 'rename'; project: ProjectMeta }
  | { kind: 'delete'; project: ProjectMeta };
export const projectDialogAtom = atom<ProjectDialog | undefined>(undefined);

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { useMatrixClient } from '../../hooks/useMatrixClient';
import { useAccountDataCallback } from '../../hooks/useAccountDataCallback';
import {
  activeProjectIdAtom,
  devKeyAtom,
  devKeyCheckedAtom,
  PROJECT_INDEX_TYPE,
  projectEventType,
  ProjectIndex,
  projectStatusAtom,
  readProjectIndex,
  saveStateAtom,
  useProjectIndex,
} from './projects';
import {
  decodeProject,
  encodeProject,
  isSealedProject,
  newProjectId,
  projectFingerprint,
} from './projectCodec';
import {
  createDevLock,
  decodeRecovery,
  dropDeviceKey,
  loadDeviceKey,
  resetPasswordWithRecovery,
  saveDeviceKey,
  unlockWithPassword,
} from './devCrypto';
import { baseWorkspaceAtom, STARTER_WORKSPACE, Workspace } from './workspace';

const SAVE_DELAY = 1500;

// Like useAccountData, but follows the event type when it changes.
function useLiveAccountData(type?: string) {
  const mx = useMatrixClient();
  const [, bump] = useState(0);
  useAccountDataCallback(
    mx,
    useCallback(
      (evt: { getType(): string }) => {
        if (evt.getType() === type) bump((n) => n + 1);
      },
      [type]
    )
  );
  return type ? mx.getAccountData(type) : undefined;
}

type Loaded = { id: string; ws: Workspace; fingerprint: string; encrypted: boolean };
type Pending = { id: string; ws: Workspace; encrypted: boolean };

// Opens the active project and saves every edit back to the account. Mount once, on the dev pages.
export function useDevProjectLoader() {
  const mx = useMatrixClient();
  const index = useProjectIndex();
  const [activeId, setActiveId] = useAtom(activeProjectIdAtom);
  const [key, setKey] = useAtom(devKeyAtom);
  const [keyChecked, setKeyChecked] = useAtom(devKeyCheckedAtom);
  const [workspace, setWorkspace] = useAtom(baseWorkspaceAtom);
  const setStatus = useSetAtom(projectStatusAtom);
  const setSaveState = useSetAtom(saveStateAtom);
  const project = index.projects.find((p) => p.id === activeId) ?? index.projects[0];
  const projectEvent = useLiveAccountData(project ? projectEventType(project.id) : undefined);
  const content = projectEvent?.getContent();

  const loaded = useRef<Loaded>();
  const pending = useRef<Pending>();
  const timer = useRef<number>();
  const keyRef = useRef(key);
  keyRef.current = key;

  const flush = useCallback(async () => {
    window.clearTimeout(timer.current);
    const job = pending.current;
    if (!job) return;
    pending.current = undefined;
    const still = readProjectIndex(mx.getAccountData(PROJECT_INDEX_TYPE)?.getContent());
    // Deleted meanwhile: don't bring it back.
    if (!still.projects.some((p) => p.id === job.id)) return;
    const sealKey = job.encrypted ? keyRef.current : undefined;
    if (job.encrypted && !sealKey) return;
    try {
      const stored = await encodeProject(job.id, job.ws, sealKey);
      if (loaded.current?.id === job.id) {
        loaded.current = { ...loaded.current, ws: job.ws, fingerprint: projectFingerprint(stored) };
      }
      await mx.setAccountData(projectEventType(job.id), stored);
      if (!pending.current) setSaveState({ state: 'saved' });
    } catch (e) {
      setSaveState({
        state: 'error',
        text: `Couldn't sync this project: ${e instanceof Error ? e.message : 'unknown error'}`,
      });
    }
  }, [mx, setSaveState]);

  useEffect(() => {
    const onHide = () => {
      flush();
    };
    window.addEventListener('pagehide', onHide);
    return () => {
      window.removeEventListener('pagehide', onHide);
      flush();
    };
  }, [flush]);

  useEffect(() => {
    if (keyChecked) return;
    loadDeviceKey(mx.getSafeUserId()).then((saved) => {
      if (saved) setKey(saved);
      setKeyChecked(true);
    });
  }, [mx, keyChecked, setKey, setKeyChecked]);

  const projectId = project?.id;
  useEffect(() => {
    if (!projectId || projectId === activeId) return;
    setActiveId(projectId);
  }, [projectId, activeId, setActiveId]);

  useEffect(() => {
    if (!keyChecked) return undefined;
    if (!project) {
      loaded.current = undefined;
      setStatus({ status: 'none' });
      return undefined;
    }
    const fingerprint = projectFingerprint(content);
    const same = loaded.current?.id === project.id;
    if (same && (loaded.current?.fingerprint === fingerprint || pending.current)) return undefined;
    if (!same && pending.current) flush();
    // Once seen encrypted, a project stays encrypted even if the index is changed to say otherwise.
    const encrypted =
      project.encrypted || isSealedProject(content) || (same && !!loaded.current?.encrypted);
    if (encrypted && !key) {
      loaded.current = undefined;
      setStatus({ status: 'locked', project });
      return undefined;
    }
    let cancelled = false;
    if (!same) setStatus({ status: 'loading' });
    decodeProject(project.id, content, encrypted ? key : undefined)
      .then((ws) => {
        if (cancelled) return;
        const next = ws ?? STARTER_WORKSPACE;
        loaded.current = { id: project.id, ws: next, fingerprint, encrypted };
        setWorkspace(next);
        setSaveState({ state: 'saved' });
        setStatus({ status: 'ready', project });
      })
      .catch(() => {
        if (cancelled) return;
        loaded.current = undefined;
        setStatus({ status: 'error', project });
      });
    return () => {
      cancelled = true;
    };
  }, [keyChecked, project, content, key, flush, setWorkspace, setStatus, setSaveState]);

  useEffect(() => {
    const { current } = loaded;
    if (!current || workspace === current.ws) return;
    pending.current = { id: current.id, ws: workspace, encrypted: current.encrypted };
    setSaveState({ state: 'saving' });
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(flush, SAVE_DELAY);
  }, [workspace, flush, setSaveState]);
}

export function useProjectActions() {
  const mx = useMatrixClient();
  const [key, setKey] = useAtom(devKeyAtom);
  const activeId = useAtomValue(activeProjectIdAtom);
  const setActive = useSetAtom(activeProjectIdAtom);

  const latestIndex = useCallback(
    () => readProjectIndex(mx.getAccountData(PROJECT_INDEX_TYPE)?.getContent()),
    [mx]
  );
  const writeIndex = useCallback(
    (index: ProjectIndex) =>
      mx.setAccountData(PROJECT_INDEX_TYPE, {
        ...(index.lock ? { lock: index.lock } : {}),
        projects: index.projects,
      }),
    [mx]
  );
  const rememberKey = useCallback(
    async (next: CryptoKey) => {
      setKey(next);
      await saveDeviceKey(mx.getSafeUserId(), next);
    },
    [mx, setKey]
  );

  const unlock = useCallback(
    async (password: string) => {
      const { lock } = latestIndex();
      if (!lock) throw new Error('No dev password is set up yet.');
      let unlocked: CryptoKey;
      try {
        unlocked = await unlockWithPassword(lock, password);
      } catch {
        throw new Error('Wrong password.');
      }
      await rememberKey(unlocked);
      return unlocked;
    },
    [latestIndex, rememberKey]
  );

  const recover = useCallback(
    async (recoveryText: string, newPassword: string) => {
      const index = latestIndex();
      const recovery = decodeRecovery(recoveryText);
      if (!index.lock || !recovery) throw new Error("That doesn't look like a recovery key.");
      let result: Awaited<ReturnType<typeof resetPasswordWithRecovery>>;
      try {
        result = await resetPasswordWithRecovery(index.lock, recovery, newPassword);
      } catch {
        throw new Error("That recovery key doesn't match.");
      }
      await writeIndex({ ...index, lock: result.lock });
      await rememberKey(result.key);
    },
    [latestIndex, writeIndex, rememberKey]
  );

  // Returns the recovery key when this made the dev password, so it can be shown once.
  const create = useCallback(
    async (opts: { name: string; encrypted: boolean; password?: string; ws: Workspace }) => {
      let sealKey = opts.encrypted ? key : undefined;
      let { lock } = latestIndex();
      let recoveryKey: string | undefined;
      if (opts.encrypted && !sealKey) {
        if (lock) {
          sealKey = await unlock(opts.password ?? '');
        } else {
          const made = await createDevLock(opts.password ?? '');
          ({ lock, recoveryKey } = made);
          sealKey = made.key;
        }
      }
      const id = newProjectId();
      await mx.setAccountData(projectEventType(id), await encodeProject(id, opts.ws, sealKey));
      const index = latestIndex();
      await writeIndex({
        lock: index.lock ?? lock,
        projects: [
          ...index.projects,
          { id, name: opts.name, encrypted: opts.encrypted, created: Date.now() },
        ],
      });
      if (recoveryKey && sealKey) await rememberKey(sealKey);
      setActive(id);
      return recoveryKey;
    },
    [mx, key, latestIndex, writeIndex, unlock, rememberKey, setActive]
  );

  const rename = useCallback(
    async (id: string, name: string) => {
      const index = latestIndex();
      await writeIndex({
        ...index,
        projects: index.projects.map((p) => (p.id === id ? { ...p, name } : p)),
      });
    },
    [latestIndex, writeIndex]
  );

  const remove = useCallback(
    async (id: string) => {
      const index = latestIndex();
      await writeIndex({ ...index, projects: index.projects.filter((p) => p.id !== id) });
      await mx.deleteAccountData(projectEventType(id));
      if (activeId === id) setActive(undefined);
    },
    [mx, activeId, latestIndex, writeIndex, setActive]
  );

  const resetEncrypted = useCallback(async () => {
    const index = latestIndex();
    const gone = index.projects.filter((p) => p.encrypted);
    await writeIndex({ projects: index.projects.filter((p) => !p.encrypted) });
    await Promise.all(gone.map((p) => mx.deleteAccountData(projectEventType(p.id))));
    setKey(undefined);
    await dropDeviceKey(mx.getSafeUserId());
  }, [mx, latestIndex, writeIndex, setKey]);

  return { unlock, recover, create, rename, remove, resetEncrypted };
}

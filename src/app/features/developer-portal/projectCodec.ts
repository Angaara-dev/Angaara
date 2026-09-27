import { fromBase64, gunzip, gzip, seal, toBase64, unseal } from './devCrypto';
import { isSealed, StoredProject } from './projects';
import { normalizeWorkspace, Workspace } from './workspace';

export const newProjectId = () =>
  Array.from(crypto.getRandomValues(new Uint8Array(8)), (b) =>
    b.toString(16).padStart(2, '0')
  ).join('');

// Ties the ciphertext to its project, so one project's data can't be swapped into another.
const projectAad = (id: string) => new TextEncoder().encode(`angaara-project:${id}`);

export const isSealedProject = (content: unknown) => isSealed((content as StoredProject)?.sealed);
// Changes whenever the stored bytes do; used to spot our own writes coming back from sync.
export const projectFingerprint = (content: unknown) => {
  const c = (content ?? {}) as StoredProject;
  return c.sealed?.ct ?? c.gz ?? '';
};

export const encodeProject = async (
  id: string,
  ws: Workspace,
  key?: CryptoKey
): Promise<StoredProject> => {
  const packed = await gzip(new TextEncoder().encode(JSON.stringify(ws)));
  if (!key) return { v: 1, gz: toBase64(packed) };
  return { v: 1, sealed: await seal(key, packed, projectAad(id)) };
};

// A project with nothing stored yet (or emptied) opens as undefined.
export const decodeProject = async (
  id: string,
  content: unknown,
  key?: CryptoKey
): Promise<Workspace | undefined> => {
  const c = (content ?? {}) as StoredProject;
  let packed: Uint8Array;
  if (isSealed(c.sealed)) {
    if (!key) throw new Error('locked');
    packed = await unseal(key, c.sealed, projectAad(id));
  } else if (typeof c.gz === 'string') {
    packed = fromBase64(c.gz);
  } else {
    return undefined;
  }
  const ws = normalizeWorkspace(JSON.parse(new TextDecoder().decode(await gunzip(packed))));
  if (!ws) throw new Error('invalid');
  return ws;
};

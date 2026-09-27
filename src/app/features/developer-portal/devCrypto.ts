// Encryption for developer projects. Everything happens in the browser with WebCrypto;
// the homeserver only ever stores the encrypted bytes.
const PBKDF2_ITERATIONS = 600000;
const KEY_WRAP_AAD = new TextEncoder().encode('angaara-dev-key');

export type Sealed = { iv: string; ct: string };
// The dev key, wrapped once by the dev password and once by the recovery key.
export type DevLock = {
  v: 1;
  iterations: number;
  salt: string;
  byPassword: Sealed;
  byRecovery: Sealed;
};

export const toBase64 = (bytes: Uint8Array): string => {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(bin);
};
export const fromBase64 = (b64: string): Uint8Array =>
  Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));

// The project's TS lib predates the compression stream types.
type GzipStream = new (format: 'gzip') => TransformStream<Uint8Array, Uint8Array>;
const { CompressionStream, DecompressionStream } = globalThis as unknown as {
  CompressionStream: GzipStream;
  DecompressionStream: GzipStream;
};
const pipeBytes = async (bytes: Uint8Array, stream: TransformStream<Uint8Array, Uint8Array>) =>
  new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(stream)).arrayBuffer());
export const gzip = (bytes: Uint8Array) => pipeBytes(bytes, new CompressionStream('gzip'));
export const gunzip = (bytes: Uint8Array) => pipeBytes(bytes, new DecompressionStream('gzip'));

const aesKey = (raw: Uint8Array, extractable = false) =>
  crypto.subtle.importKey('raw', raw, 'AES-GCM', extractable, ['encrypt', 'decrypt']);

export const seal = async (key: CryptoKey, data: Uint8Array, aad: Uint8Array): Promise<Sealed> => {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: aad }, key, data);
  return { iv: toBase64(iv), ct: toBase64(new Uint8Array(ct)) };
};
// Throws when the key is wrong or the data was tampered with.
export const unseal = async (key: CryptoKey, sealed: Sealed, aad: Uint8Array) =>
  new Uint8Array(
    await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: fromBase64(sealed.iv), additionalData: aad },
      key,
      fromBase64(sealed.ct)
    )
  );

export const passwordKey = async (password: string, salt: Uint8Array, iterations: number) => {
  const base = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
};

// Recovery keys are 32 random bytes shown as base32 in groups of four.
const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const encodeRecovery = (bytes: Uint8Array) => {
  let bits = '';
  bytes.forEach((b) => {
    bits += b.toString(2).padStart(8, '0');
  });
  const chars = (bits.match(/.{1,5}/g) ?? []).map((c) => B32[parseInt(c.padEnd(5, '0'), 2)]);
  return (chars.join('').match(/.{1,4}/g) ?? []).join('-');
};
export const decodeRecovery = (text: string): Uint8Array | undefined => {
  const clean = text.toUpperCase().replace(/[^A-Z2-7]/g, '');
  if (clean.length !== 52) return undefined;
  const bits = Array.from(clean, (c) => B32.indexOf(c).toString(2).padStart(5, '0')).join('');
  return Uint8Array.from(bits.slice(0, 256).match(/.{8}/g) ?? [], (b) => parseInt(b, 2));
};

const wrapWithPassword = async (raw: Uint8Array, password: string) => {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const kek = await passwordKey(password, salt, PBKDF2_ITERATIONS);
  return {
    salt: toBase64(salt),
    iterations: PBKDF2_ITERATIONS,
    byPassword: await seal(kek, raw, KEY_WRAP_AAD),
  };
};

// Makes a new dev key. Returns the lock to store, the key, and the recovery key to show once.
export const createDevLock = async (password: string) => {
  const raw = crypto.getRandomValues(new Uint8Array(32));
  const recovery = crypto.getRandomValues(new Uint8Array(32));
  const lock: DevLock = {
    v: 1,
    ...(await wrapWithPassword(raw, password)),
    byRecovery: await seal(await aesKey(recovery), raw, KEY_WRAP_AAD),
  };
  return { lock, key: await aesKey(raw), recoveryKey: encodeRecovery(recovery) };
};

export const unlockWithPassword = async (lock: DevLock, password: string) => {
  const kek = await passwordKey(password, fromBase64(lock.salt), lock.iterations);
  return aesKey(await unseal(kek, lock.byPassword, KEY_WRAP_AAD));
};

// Recovery unlocks the key and sets a new password; the recovery key itself stays valid.
export const resetPasswordWithRecovery = async (
  lock: DevLock,
  recovery: Uint8Array,
  newPassword: string
) => {
  const raw = await unseal(await aesKey(recovery), lock.byRecovery, KEY_WRAP_AAD);
  const next: DevLock = { ...lock, ...(await wrapWithPassword(raw, newPassword)) };
  return { lock: next, key: await aesKey(raw) };
};

// Unlocked keys stay on this device (non-extractable, so scripts can use but never read them).
const DB_NAME = 'angaara-dev-keys';
const openDb = () =>
  new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore('keys');
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
const keyRequest = async <T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest
): Promise<T | undefined> => {
  const db = await openDb();
  try {
    return await new Promise<T | undefined>((resolve, reject) => {
      const req = run(db.transaction('keys', mode).objectStore('keys'));
      req.onsuccess = () => resolve(req.result as T | undefined);
      req.onerror = () => reject(req.error);
    });
  } finally {
    db.close();
  }
};
export const loadDeviceKey = (userId: string) =>
  keyRequest<CryptoKey>('readonly', (s) => s.get(userId)).catch(() => undefined);
export const saveDeviceKey = (userId: string, key: CryptoKey) =>
  keyRequest('readwrite', (s) => s.put(key, userId)).catch(() => undefined);
export const dropDeviceKey = (userId: string) =>
  keyRequest('readwrite', (s) => s.delete(userId)).catch(() => undefined);
// Called on logout so a signed-out browser keeps no unlocked keys.
export const forgetDeviceKeys = () =>
  new Promise<void>((resolve) => {
    const req = indexedDB.deleteDatabase(DB_NAME);
    req.onsuccess = () => resolve();
    req.onerror = () => resolve();
    req.onblocked = () => resolve();
  });

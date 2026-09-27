import {
  fromBase64,
  passwordKey,
  seal,
  Sealed,
  toBase64,
  unseal,
} from '../app/features/developer-portal/devCrypto';

// App lock: this device's encryption-key store is encrypted with a random 32-byte key.
// Unlocked, the key sits on the device; locked, it's wrapped with the user's app-lock password.
const DB_NAME = 'angaara-store-key';
const RUST_STORE_DB = 'matrix-js-sdk::matrix-sdk-crypto';
const SESSION_PREFIX = 'angaara.storeKey.';
const ITERATIONS = 600000;
const WRAP_AAD = new TextEncoder().encode('angaara-store-key');

type PlainRecord = { mode: 'plain'; key: string };
type LockedRecord = { mode: 'locked'; salt: string; iterations: number; wrapped: Sealed };
type StoreKeyRecord = PlainRecord | LockedRecord;
export type AppLockState = 'legacy' | 'off' | 'on';

export class AppLockedError extends Error {
  constructor() {
    super('App lock is on.');
  }
}

const recordId = (userId: string, deviceId: string) => `${userId}|${deviceId}`;

const request = async <T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest
): Promise<T | undefined> => {
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore('keys');
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
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
const readRecord = (id: string) => request<StoreKeyRecord>('readonly', (s) => s.get(id));
const writeRecord = (id: string, record: StoreKeyRecord) =>
  request('readwrite', (s) => s.put(record, id));

const rememberForSession = (id: string, key: Uint8Array) => {
  try {
    sessionStorage.setItem(SESSION_PREFIX + id, toBase64(key));
  } catch {
    // Storage blocked: the password is just asked again after a reload.
  }
};
const sessionKey = (id: string): Uint8Array | undefined => {
  try {
    const b64 = sessionStorage.getItem(SESSION_PREFIX + id);
    return b64 ? fromBase64(b64) : undefined;
  } catch {
    return undefined;
  }
};

// Only a store created by a fresh sign-in can be encrypted; older ones stay as they are.
const rustStoreExists = async () => {
  if (!indexedDB.databases) return true;
  const dbs = await indexedDB.databases();
  return dbs.some((db) => db.name === RUST_STORE_DB);
};

// The key to open this device's store with: undefined for a pre-app-lock store.
// Throws AppLockedError when the password is needed first.
export const getStoreKey = async (
  userId: string,
  deviceId: string
): Promise<Uint8Array | undefined> => {
  const id = recordId(userId, deviceId);
  const record = await readRecord(id);
  if (!record) {
    if (await rustStoreExists()) return undefined;
    const key = crypto.getRandomValues(new Uint8Array(32));
    await writeRecord(id, { mode: 'plain', key: toBase64(key) });
    return key;
  }
  if (record.mode === 'plain') return fromBase64(record.key);
  const key = sessionKey(id);
  if (key) return key;
  throw new AppLockedError();
};

export const getAppLockState = async (userId: string, deviceId: string): Promise<AppLockState> => {
  const record = await readRecord(recordId(userId, deviceId));
  if (!record) return 'legacy';
  return record.mode === 'locked' ? 'on' : 'off';
};

const unwrap = async (record: LockedRecord, password: string) => {
  const kek = await passwordKey(password, fromBase64(record.salt), record.iterations);
  try {
    return await unseal(kek, record.wrapped, WRAP_AAD);
  } catch {
    throw new Error('Wrong password.');
  }
};

export const unlockApp = async (userId: string, deviceId: string, password: string) => {
  const id = recordId(userId, deviceId);
  const record = await readRecord(id);
  if (record?.mode !== 'locked') return;
  rememberForSession(id, await unwrap(record, password));
};

// The current key, from the plain record or this session's unlock.
const currentKey = async (id: string, record?: StoreKeyRecord) => {
  if (record?.mode === 'plain') return fromBase64(record.key);
  const key = sessionKey(id);
  if (!key) throw new Error('Unlock the app first.');
  return key;
};

export const setAppLockPassword = async (userId: string, deviceId: string, password: string) => {
  const id = recordId(userId, deviceId);
  const record = await readRecord(id);
  if (!record) throw new Error('App lock needs a fresh sign-in on this device first.');
  const key = await currentKey(id, record);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const kek = await passwordKey(password, salt, ITERATIONS);
  await writeRecord(id, {
    mode: 'locked',
    salt: toBase64(salt),
    iterations: ITERATIONS,
    wrapped: await seal(kek, key, WRAP_AAD),
  });
  rememberForSession(id, key);
};

export const turnOffAppLock = async (userId: string, deviceId: string, password: string) => {
  const id = recordId(userId, deviceId);
  const record = await readRecord(id);
  if (record?.mode !== 'locked') return;
  const key = await unwrap(record, password);
  await writeRecord(id, { mode: 'plain', key: toBase64(key) });
};

// Logout: forget the key everywhere, since the store it opened is being deleted too.
export const forgetStoreKeys = async () => {
  try {
    Object.keys(sessionStorage)
      .filter((k) => k.startsWith(SESSION_PREFIX))
      .forEach((k) => sessionStorage.removeItem(k));
  } catch {
    // Nothing kept there.
  }
  await new Promise<void>((resolve) => {
    const req = indexedDB.deleteDatabase(DB_NAME);
    req.onsuccess = () => resolve();
    req.onerror = () => resolve();
    req.onblocked = () => resolve();
  });
};

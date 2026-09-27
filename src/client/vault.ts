import { ClientEvent, MatrixClient, MatrixEvent } from 'matrix-js-sdk';
import { CryptoEvent } from 'matrix-js-sdk/lib/crypto-api';

// Encrypted account data: private lists (friends, DMs) the homeserver only sees as ciphertext.
// Items use AES-256-GCM with a random vault key; that key is wrapped with a key derived
// (HKDF-SHA-256) from your key backup key, and also kept in secret storage (AES-256 + HMAC-SHA-256).

export type VaultItem = 'friends' | 'direct' | 'privacy';
const ITEMS: VaultItem[] = ['friends', 'direct', 'privacy'];
const ITEM_PREFIX = 'io.angaara.vault.';
const KEY_WRAP_TYPE = 'io.angaara.vault_key';
const SSSS_NAME = 'io.angaara.vault_key';

// loading: starting up. no-backup: key backup isn't set up on this device yet.
// locked: the vault exists but this device can't open it without the recovery key.
export type VaultStatus = 'loading' | 'ready' | 'no-backup' | 'locked';

type Sealed = { v: 1; alg: 'A256GCM'; iv: string; ct: string };
type WrappedKey = Sealed & { backup_version: string };

const enc = new TextEncoder();
const dec = new TextDecoder();
const toB64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
const fromB64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

const isSealed = (c: unknown): c is Sealed =>
  !!c &&
  typeof c === 'object' &&
  (c as Sealed).alg === 'A256GCM' &&
  typeof (c as Sealed).iv === 'string' &&
  typeof (c as Sealed).ct === 'string';

async function seal(key: CryptoKey, data: Uint8Array, aad: string): Promise<Sealed> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: enc.encode(aad) },
    key,
    data
  );
  return { v: 1, alg: 'A256GCM', iv: toB64(iv), ct: toB64(new Uint8Array(ct)) };
}

async function open(key: CryptoKey, sealed: Sealed, aad: string): Promise<Uint8Array> {
  const pt = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: fromB64(sealed.iv), additionalData: enc.encode(aad) },
    key,
    fromB64(sealed.ct)
  );
  return new Uint8Array(pt);
}

async function wrapKeyFromBackup(backupKey: Uint8Array, userId: string): Promise<CryptoKey> {
  const ikm = await crypto.subtle.importKey('raw', backupKey, 'HKDF', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: enc.encode('io.angaara.vault.v1'),
      info: enc.encode(userId),
    },
    ikm,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

const importVaultKey = (raw: Uint8Array) =>
  crypto.subtle.importKey('raw', raw, { name: 'AES-GCM', length: 256 }, false, [
    'encrypt',
    'decrypt',
  ]);

type State = {
  mx?: MatrixClient;
  status: VaultStatus;
  key?: CryptoKey;
  values: Map<VaultItem, unknown>;
  // Items that exist but didn't decrypt; never overwritten, so nothing is lost.
  broken: Set<VaultItem>;
  version: number;
};
const state: State = { status: 'loading', values: new Map(), broken: new Set(), version: 0 };
const listeners = new Set<() => void>();

const emit = () => {
  state.version += 1;
  listeners.forEach((l) => l());
};

export const subscribeVault = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
export const getVaultVersion = () => state.version;
export const getVaultStatus = () => state.status;
export const getVaultItem = <T>(item: VaultItem): T | undefined =>
  state.values.get(item) as T | undefined;

const itemAad = (mx: MatrixClient, item: VaultItem) =>
  `${ITEM_PREFIX}${item}|${mx.getSafeUserId()}`;

async function readItem(mx: MatrixClient, key: CryptoKey, item: VaultItem) {
  const content = mx.getAccountData(`${ITEM_PREFIX}${item}` as any)?.getContent();
  if (!isSealed(content)) {
    state.values.delete(item);
    state.broken.delete(item);
    return;
  }
  try {
    const value = JSON.parse(dec.decode(await open(key, content, itemAad(mx, item))));
    state.values.set(item, value);
    state.broken.delete(item);
  } catch {
    state.values.delete(item);
    state.broken.add(item);
  }
}

async function fromSecretStorage(mx: MatrixClient): Promise<Uint8Array | undefined> {
  try {
    const secret = await mx.secretStorage.get(SSSS_NAME as any);
    return secret ? fromB64(secret) : undefined;
  } catch {
    // Secret storage key isn't cached on this device.
    return undefined;
  }
}

async function storedInSecretStorage(mx: MatrixClient): Promise<boolean> {
  try {
    return !!(await mx.secretStorage.isStored(SSSS_NAME as any));
  } catch {
    return false;
  }
}

let unlocking: Promise<void> | undefined;

async function doUnlock(mx: MatrixClient) {
  const cryptoApi = mx.getCrypto();
  const userId = mx.getSafeUserId();
  const backupKey = (await cryptoApi?.getSessionBackupPrivateKey()) ?? undefined;
  const backupVersion =
    (await cryptoApi?.getActiveSessionBackupVersion()) ??
    (await cryptoApi?.getKeyBackupInfo())?.version ??
    undefined;
  const wrapped = mx.getAccountData(KEY_WRAP_TYPE as any)?.getContent() as WrappedKey | undefined;
  const wrapAad = (version: string) => `${KEY_WRAP_TYPE}|${userId}|${version}`;

  let raw: Uint8Array | undefined;
  let created = false;
  if (backupKey && backupVersion && isSealed(wrapped) && wrapped.backup_version === backupVersion) {
    try {
      raw = await open(await wrapKeyFromBackup(backupKey, userId), wrapped, wrapAad(backupVersion));
    } catch {
      raw = undefined;
    }
  }
  raw ??= await fromSecretStorage(mx);

  if (!raw) {
    const exists =
      isSealed(wrapped) ||
      ITEMS.some((item) => !!mx.getAccountData(`${ITEM_PREFIX}${item}` as any)) ||
      (await storedInSecretStorage(mx));
    // Only a brand-new vault gets a new key, so an existing one is never replaced.
    if (!exists && backupKey && backupVersion) {
      raw = crypto.getRandomValues(new Uint8Array(32));
      created = true;
    }
  }

  if (!raw) {
    state.status = backupKey ? 'locked' : 'no-backup';
    state.key = undefined;
    state.values.clear();
    emit();
    return;
  }

  if (backupKey && backupVersion && (created || wrapped?.backup_version !== backupVersion)) {
    const sealed = await seal(
      await wrapKeyFromBackup(backupKey, userId),
      raw,
      wrapAad(backupVersion)
    );
    await mx.setAccountData(KEY_WRAP_TYPE as any, { ...sealed, backup_version: backupVersion });
  }
  if (!(await storedInSecretStorage(mx))) {
    // Needs the recovery key cached; if it isn't, the backup-wrapped copy is enough for now.
    await mx.secretStorage.store(SSSS_NAME as any, toB64(raw)).catch(() => undefined);
  }

  state.key = await importVaultKey(raw);
  raw.fill(0);
  await Promise.all(ITEMS.map((item) => readItem(mx, state.key as CryptoKey, item)));
  state.status = 'ready';
  emit();
}

export const unlockVault = (): Promise<void> => {
  const { mx } = state;
  if (!mx) return Promise.resolve();
  unlocking ??= doUnlock(mx)
    .catch(() => {
      if (state.status === 'loading') {
        state.status = 'locked';
        emit();
      }
    })
    .finally(() => {
      unlocking = undefined;
    });
  return unlocking;
};

// Read-modify-write one item; refuses while locked or if the stored copy didn't decrypt.
export async function updateVaultItem<T>(item: VaultItem, change: (prev: T | undefined) => T) {
  const { mx, key } = state;
  if (!mx || !key || state.status !== 'ready') throw new Error('Your encrypted data is locked.');
  if (state.broken.has(item)) throw new Error("Your encrypted data couldn't be read.");
  const next = change(state.values.get(item) as T | undefined);
  const sealed = await seal(key, enc.encode(JSON.stringify(next)), itemAad(mx, item));
  state.values.set(item, next);
  emit();
  await mx.setAccountData(`${ITEM_PREFIX}${item}` as any, sealed as any);
}

export const vaultReady = () => state.status === 'ready';

// Starts the vault for this client; returns a cleanup for logout or client changes.
export function startVault(mx: MatrixClient): () => void {
  state.mx = mx;
  state.status = 'loading';
  state.key = undefined;
  state.values.clear();
  state.broken.clear();
  emit();

  const onAccountData = (event: MatrixEvent) => {
    const type = event.getType();
    if (type === KEY_WRAP_TYPE && state.status !== 'ready') {
      unlockVault();
      return;
    }
    const item = type.startsWith(ITEM_PREFIX)
      ? (type.slice(ITEM_PREFIX.length) as VaultItem)
      : null;
    if (!item || !ITEMS.includes(item)) return;
    if (state.key && state.status === 'ready') {
      readItem(mx, state.key, item).then(emit);
    } else {
      unlockVault();
    }
  };
  const onBackupKey = () => {
    if (state.status !== 'ready') unlockVault();
  };

  mx.on(ClientEvent.AccountData, onAccountData);
  mx.on(CryptoEvent.KeyBackupDecryptionKeyCached, onBackupKey);
  mx.on(CryptoEvent.KeyBackupStatus, onBackupKey);
  unlockVault();

  return () => {
    mx.removeListener(ClientEvent.AccountData, onAccountData);
    mx.removeListener(CryptoEvent.KeyBackupDecryptionKeyCached, onBackupKey);
    mx.removeListener(CryptoEvent.KeyBackupStatus, onBackupKey);
    if (state.mx === mx) {
      state.mx = undefined;
      state.key = undefined;
      state.values.clear();
      state.status = 'loading';
      emit();
    }
  };
}

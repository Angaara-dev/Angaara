import { createClient, MatrixClient, IndexedDBStore, IndexedDBCryptoStore } from 'matrix-js-sdk';
import SyncStoreWorker from './syncStore.worker?worker';

import { cryptoCallbacks } from './secretStorageKeys';
import { clearNavToActivePathStore } from '../app/state/navToActivePath';
import { forgetDeviceKeys } from '../app/features/developer-portal/devCrypto';
import { pushSessionToSW } from '../sw-session';
import { forgetStoreKeys, getStoreKey } from './storeKey';
import { installPrivateReactions } from './privateReactions';
import { installHiddenProfiles } from './hiddenProfile';

type Session = {
  baseUrl: string;
  accessToken: string;
  userId: string;
  deviceId: string;
};

export const initClient = async (session: Session): Promise<MatrixClient> => {
  // Throws AppLockedError when app lock is on and this session hasn't been unlocked.
  const storageKey = await getStoreKey(session.userId, session.deviceId);

  const indexedDBStore = new IndexedDBStore({
    indexedDB: global.indexedDB,
    localStorage: global.localStorage,
    dbName: 'web-sync-store',
    // Same database, just loaded in a worker instead of blocking the page.
    workerFactory: typeof Worker === 'undefined' ? undefined : () => new SyncStoreWorker(),
  });

  const legacyCryptoStore = new IndexedDBCryptoStore(global.indexedDB, 'crypto-store');

  const mx = createClient({
    baseUrl: session.baseUrl,
    accessToken: session.accessToken,
    userId: session.userId,
    store: indexedDBStore,
    cryptoStore: legacyCryptoStore,
    deviceId: session.deviceId,
    timelineSupport: true,
    cryptoCallbacks: cryptoCallbacks as any,
    verificationMethods: ['m.sas.v1'],
  });

  await indexedDBStore.startup();
  await mx.initRustCrypto({ storageKey });

  mx.setMaxListeners(50);
  installPrivateReactions(mx);
  installHiddenProfiles(mx);

  return mx;
};

export const startClient = async (mx: MatrixClient) => {
  await mx.startClient({
    lazyLoadMembers: true,
  });
};

export const clearCacheAndReload = async (mx: MatrixClient) => {
  mx.stopClient();
  clearNavToActivePathStore(mx.getSafeUserId());
  await mx.store.deleteAllData();
  window.location.reload();
};

// The service worker keeps downloaded media; it's private, so it goes on logout.
const clearMediaCache = () => window.caches?.delete('angaara-media-v1').catch(() => false);

export const logoutClient = async (mx: MatrixClient) => {
  pushSessionToSW();
  mx.stopClient();
  try {
    await mx.logout();
  } catch {
    // ignore if failed to logout
  }
  await mx.clearStores();
  await forgetDeviceKeys();
  await forgetStoreKeys();
  await clearMediaCache();
  window.localStorage.clear();
  window.location.reload();
};

export const clearLoginData = async () => {
  await forgetStoreKeys();
  await clearMediaCache();
  const dbs = await window.indexedDB.databases();

  dbs.forEach((idbInfo) => {
    const { name } = idbInfo;
    if (name) {
      window.indexedDB.deleteDatabase(name);
    }
  });

  window.localStorage.clear();
  window.location.reload();
};

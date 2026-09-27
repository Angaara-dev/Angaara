import { IndexedDBStoreWorker } from 'matrix-js-sdk/lib/indexeddb-worker';

// Runs the sync cache's IndexedDB work off the main thread, so refreshes don't freeze the UI.
const ctx = globalThis as unknown as {
  postMessage: (message: unknown) => void;
  onmessage: ((ev: MessageEvent) => void) | null;
};
const remoteWorker = new IndexedDBStoreWorker((message: unknown) => ctx.postMessage(message));
ctx.onmessage = remoteWorker.onMessage;

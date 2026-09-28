import { scanBytes } from './inspect';

type Job = { name: string; buffer: ArrayBuffer; rulesUrl: string };

const ctx = globalThis as unknown as {
  postMessage: (message: unknown) => void;
  onmessage: ((ev: MessageEvent<Job>) => void) | null;
};

// One file per worker; the app terminates it to cancel.
ctx.onmessage = async ({ data }) => {
  try {
    ctx.postMessage({
      result: await scanBytes(data.name, new Uint8Array(data.buffer), data.rulesUrl),
    });
  } catch (e) {
    ctx.postMessage({ error: e instanceof Error ? e.message : 'scan failed' });
  }
};

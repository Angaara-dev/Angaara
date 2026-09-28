import { MatrixClient } from 'matrix-js-sdk';
import { trimTrailingSlash } from '../../utils/common';
import { CheckQuota } from './linkCheck';
import type { LocalScan } from './scan/inspect';

// Everything here runs on your device; only the file's SHA-256 fingerprint can leave it.
export type FileReport = LocalScan & {
  verdict: 'ok' | 'warn' | 'bad';
  name: string;
  // Known-malware lookup: true/false once asked, undefined if it couldn't be.
  listed?: boolean;
  listedName?: string;
  lookupNote?: string;
  // A published file this matches, from CIRCL's list of known software.
  known?: string;
  quota?: CheckQuota;
};

const TIMEOUT = 3 * 60 * 1000;

// Scans in a worker so the app never freezes. Aborting kills the worker straight away.
const scanInWorker = (name: string, buffer: ArrayBuffer, signal: AbortSignal) =>
  new Promise<LocalScan>((resolve, reject) => {
    if (signal.aborted) {
      reject(new Error('Scan cancelled.'));
      return;
    }
    const worker = new Worker(new URL('./scan/scan.worker.ts', import.meta.url), {
      type: 'module',
    });
    let timer: ReturnType<typeof setTimeout> | undefined;
    let onAbort: () => void = () => undefined;
    const stop = (error?: Error, result?: LocalScan) => {
      clearTimeout(timer);
      signal.removeEventListener('abort', onAbort);
      worker.terminate();
      if (result) resolve(result);
      else reject(error);
    };
    onAbort = () => stop(new Error('Scan cancelled.'));
    timer = setTimeout(() => stop(new Error('The scan took too long.')), TIMEOUT);
    signal.addEventListener('abort', onAbort);
    worker.onmessage = (evt: MessageEvent<{ result?: LocalScan; error?: string }>) =>
      stop(new Error(evt.data.error ?? "Couldn't check this file."), evt.data.result);
    worker.onerror = () => stop(new Error("Couldn't check this file."));
    worker.postMessage(
      {
        name,
        buffer,
        rulesUrl: `${trimTrailingSlash(import.meta.env.BASE_URL)}/yara/reversinglabs.yar`,
      },
      [buffer]
    );
  });

type Lookup = Pick<FileReport, 'listed' | 'listedName' | 'known' | 'quota'>;

const lookUp = async (mx: MatrixClient, sha256: string): Promise<Lookup> => {
  const res = await fetch(`${window.location.origin}/api/links/file`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ openid: await mx.getOpenIdToken(), sha256 }),
  });
  const data = await res.json().catch(() => undefined);
  if (!res.ok) throw new Error(data?.error ?? "The known-malware list couldn't be checked.");
  return { listed: data.listed, listedName: data.name, known: data.known, quota: data.quota };
};

// Checks a file locally, then (unless told not to) looks up its fingerprint.
export const checkFile = async (
  mx: MatrixClient,
  name: string,
  blob: Blob,
  lookup: boolean,
  signal: AbortSignal
): Promise<FileReport> => {
  const local = await scanInWorker(name, await blob.arrayBuffer(), signal);
  const report: FileReport = { ...local, verdict: 'ok', name };
  if (lookup && local.sha256) {
    try {
      Object.assign(report, await lookUp(mx, local.sha256));
    } catch (e) {
      report.lookupNote =
        e instanceof Error ? e.message : "The known-malware list couldn't be checked.";
    }
  }
  if (report.listed) {
    report.findings.unshift({
      level: 'bad',
      text: `It's known malware${
        report.listedName ? ` (${report.listedName})` : ''
      }, listed on MalwareBazaar.`,
    });
  }
  // Worst first, so the reason for the verdict is at the top.
  report.findings.sort((a, b) => Number(b.level === 'bad') - Number(a.level === 'bad'));
  if (report.findings.some((f) => f.level === 'warn')) report.verdict = 'warn';
  if (report.findings.some((f) => f.level === 'bad')) report.verdict = 'bad';
  return report;
};

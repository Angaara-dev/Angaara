import { MatrixClient } from 'matrix-js-sdk';
import FileSaver from 'file-saver';
import { UAParser } from 'ua-parser-js';

// Crash and bug reports go to the Worker and are read by accounts with the developer badge.
const reportsApi = (path = '') => `${window.location.origin}/api/reports${path}`;

export type AppReport = {
  id: number;
  at: number;
  message: string | null;
  stack: string | null;
  path: string | null;
  build: string | null;
  ua: string | null;
  note: string | null;
};

// Room, user, alias and event IDs say where someone was, so they never leave the device.
export const cleanPath = (path: string): string =>
  decodeURIComponent(path)
    .replace(/![^/?#]+/g, '!room')
    .replace(/@[^/?#]+/g, '@user')
    .replace(/#[^/?]+/g, '#alias')
    .replace(/\$[^/?#]+/g, '$event');

// The main script's hashed name says exactly which build crashed.
export const buildId = (): string =>
  document.querySelector<HTMLScriptElement>('script[type="module"][src]')?.src.split('/').pop() ??
  'dev';

const describe = (error: unknown): { message: string; stack?: string } => {
  if (error instanceof Error) return { message: error.message || error.name, stack: error.stack };
  if (error && typeof error === 'object' && 'statusText' in error) {
    const { status, statusText } = error as { status?: number; statusText?: string };
    return { message: `${status ?? ''} ${statusText ?? ''}`.trim() || 'Route error' };
  }
  return { message: String(error) };
};

export type CrashReport = {
  message: string;
  stack?: string;
  note?: string;
  path: string;
  build: string;
};

// Exactly what a crash report sends, so the crash screen can show it before anything goes.
// The worker also stores the browser's user agent, which the crash screen shows too.
export const crashReport = (error: unknown, note: string): CrashReport => {
  const { message, stack } = describe(error);
  return {
    message: message.slice(0, 500),
    stack: stack?.slice(0, 4000),
    note: note.trim() || undefined,
    path: cleanPath(window.location.pathname + window.location.hash),
    build: buildId(),
  };
};

// Sent without who you are: the app may be too broken to prove it, and it's not needed.
export const sendReport = async (report: CrashReport): Promise<void> => {
  const res = await fetch(reportsApi(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(report),
  });
  if (res.status === 429) throw new Error('Too many reports from here right now. Try later.');
  if (!res.ok) throw new Error("Couldn't send the report.");
};

export const BUG_TYPES = [
  { key: 'crash', label: 'App crashed or froze' },
  { key: 'chat', label: 'Messages and chat' },
  { key: 'calls', label: 'Calls and voice' },
  { key: 'servers', label: 'Servers and rooms' },
  { key: 'profile', label: 'Profile and settings' },
  { key: 'looks', label: 'Something looks wrong' },
  { key: 'slow', label: 'Slow or laggy' },
  { key: 'other', label: 'Something else' },
] as const;
export type BugType = typeof BUG_TYPES[number]['key'];
export const bugTypeLabel = (key: string): string =>
  BUG_TYPES.find((t) => t.key === key)?.label ?? key;

export type BugReport = {
  id: number;
  at: number;
  type: string;
  title: string;
  body: string;
  build: string | null;
  ua: string | null;
  archivedAt: number | null;
  archivedBy: string | null;
};

// Anonymous, like crash reports: no account, user ID or rooms go with it.
export const sendBugReport = async (type: BugType, title: string, body: string): Promise<void> => {
  const res = await fetch(reportsApi('/bug'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type, title: title.trim(), body: body.trim(), build: buildId() }),
  });
  if (res.status === 429) throw new Error('Too many reports from here right now. Try later.');
  if (!res.ok) throw new Error("Couldn't send the report.");
};

const asDev = async (mx: MatrixClient, path: string, extra: Record<string, unknown> = {}) => {
  const res = await fetch(reportsApi(path), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ openid: await mx.getOpenIdToken(), ...extra }),
  });
  return res.json();
};

export const listReports = async (mx: MatrixClient): Promise<AppReport[] | undefined> => {
  const data = await asDev(mx, '/list');
  return data?.dev ? (data.reports as AppReport[]) : undefined;
};

export const resolveReport = async (mx: MatrixClient, id: number): Promise<void> => {
  const data = await asDev(mx, '/resolve', { id });
  if (!data?.deleted) throw new Error("Couldn't mark it done.");
};

export const listBugReports = async (mx: MatrixClient): Promise<BugReport[] | undefined> => {
  const data = await asDev(mx, '/bugs/list');
  return data?.dev ? (data.reports as BugReport[]) : undefined;
};

export const archiveBugReport = async (mx: MatrixClient, id: number): Promise<void> => {
  const data = await asDev(mx, '/bugs/resolve', { id });
  if (data?.archived !== true) throw new Error("Couldn't archive it.");
};

export const reopenBugReport = async (mx: MatrixClient, id: number): Promise<void> => {
  const data = await asDev(mx, '/bugs/reopen', { id });
  if (data?.archived !== false) throw new Error("Couldn't reopen it.");
};

const deviceOf = (ua: string | null) => {
  if (!ua) return null;
  const { browser, os, device } = UAParser(ua);
  return {
    browser: browser.name ?? null,
    browserVersion: browser.version ?? null,
    os: os.name ?? null,
    osVersion: os.version ?? null,
    device: device.type ?? 'desktop',
  };
};

const iso = (at: number) => new Date(at).toISOString();

const saveJson = (name: string, reports: unknown[]) => {
  const file = { exportedAt: new Date().toISOString(), count: reports.length, reports };
  const blob = new Blob([JSON.stringify(file, null, 2)], { type: 'application/json' });
  FileSaver.saveAs(blob, `angaara-${name}-${new Date().toISOString().slice(0, 10)}.json`);
};

export const exportBugReports = (reports: BugReport[]) =>
  saveJson(
    'bug-reports',
    reports.map((r) => ({
      id: r.id,
      reportedAt: iso(r.at),
      type: r.type,
      typeLabel: bugTypeLabel(r.type),
      title: r.title,
      body: r.body,
      build: r.build,
      ...deviceOf(r.ua),
      userAgent: r.ua,
    }))
  );

export const exportCrashReports = (reports: AppReport[]) =>
  saveJson(
    'crash-reports',
    reports.map((r) => ({
      id: r.id,
      reportedAt: iso(r.at),
      message: r.message,
      note: r.note,
      page: r.path,
      build: r.build,
      ...deviceOf(r.ua),
      userAgent: r.ua,
      stack: r.stack,
    }))
  );

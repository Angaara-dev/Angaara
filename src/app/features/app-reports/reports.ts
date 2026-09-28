import { MatrixClient } from 'matrix-js-sdk';

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

// Sent without who you are: the app may be too broken to prove it, and it's not needed.
export const sendReport = async (error: unknown, note: string): Promise<void> => {
  const { message, stack } = describe(error);
  const res = await fetch(reportsApi(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message,
      stack,
      note: note.trim() || undefined,
      path: cleanPath(window.location.pathname + window.location.hash),
      build: buildId(),
    }),
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

export const resolveBugReport = async (mx: MatrixClient, id: number): Promise<void> => {
  const data = await asDev(mx, '/bugs/resolve', { id });
  if (!data?.deleted) throw new Error("Couldn't mark it done.");
};

// Crash reports from the app's error screen, stored in the XP_DB D1. Readable only by accounts
// with the "developer" badge in config.json, plus any listed in the optional APP_DEVS secret.
import { verifyOpenId } from './perks.js';

const HOUR = 60 * 60 * 1000;
// Per sender (hashed IP) per hour, so a crash loop or a script can't flood the table.
const MAX_PER_HOUR = 10;
const MAX_STORED = 2000;
const LIMITS = { message: 500, stack: 4000, path: 200, build: 80, ua: 300, note: 1000 };

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });

let tableReady;
const ensureTable = (db) => {
  tableReady ??= db
    .batch([
      db.prepare(
        `CREATE TABLE IF NOT EXISTS app_reports (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          at INTEGER NOT NULL,
          message TEXT, stack TEXT, path TEXT, build TEXT, ua TEXT, note TEXT
        )`
      ),
      db.prepare(
        `CREATE TABLE IF NOT EXISTS app_report_rate (
          sender TEXT PRIMARY KEY,
          window INTEGER NOT NULL,
          count INTEGER NOT NULL
        )`
      ),
    ])
    .catch((err) => {
      tableReady = undefined;
      throw err;
    });
  return tableReady;
};

// The same config.json the app gets, so the dev badge and report access stay one list.
async function devs(env, url) {
  const ids = (env.APP_DEVS ?? '').split(',');
  try {
    const res = await env.ASSETS.fetch(new Request(new URL('/config.json', url.origin)));
    const badges = (await res.json())?.badges ?? {};
    Object.entries(badges).forEach(([id, list]) => {
      if (Array.isArray(list) && list.includes('developer')) ids.push(id);
    });
  } catch {
    // Without the config, only APP_DEVS counts.
  }
  return new Set(ids.map((id) => id.trim().toLowerCase()).filter(Boolean));
}

// Only a hash of the IP is kept, and only for the rate limit.
const senderKey = async (request) => {
  const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown';
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`report:${ip}`));
  return btoa(String.fromCharCode(...new Uint8Array(digest))).slice(0, 22);
};

const clip = (value, max) => (typeof value === 'string' ? value.slice(0, max) : null);

async function submit(request, env) {
  const body = await request.json().catch(() => undefined);
  if (!body || typeof body.message !== 'string') return json({ error: 'bad report' }, 400);
  const db = env.XP_DB;
  const now = Date.now();
  const sender = await senderKey(request);
  const rate = await db
    .prepare('SELECT window, count FROM app_report_rate WHERE sender = ?')
    .bind(sender)
    .first();
  const fresh = !rate || now - rate.window > HOUR;
  if (!fresh && rate.count >= MAX_PER_HOUR) return json({ error: 'too many reports' }, 429);
  await db.batch([
    db
      .prepare(
        `INSERT INTO app_report_rate (sender, window, count) VALUES (?1, ?2, 1)
         ON CONFLICT(sender) DO UPDATE SET
           window = CASE WHEN ?3 THEN ?2 ELSE window END,
           count = CASE WHEN ?3 THEN 1 ELSE count + 1 END`
      )
      .bind(sender, now, fresh ? 1 : 0),
    db
      .prepare(
        'INSERT INTO app_reports (at, message, stack, path, build, ua, note) VALUES (?, ?, ?, ?, ?, ?, ?)'
      )
      .bind(
        now,
        clip(body.message, LIMITS.message),
        clip(body.stack, LIMITS.stack),
        clip(body.path, LIMITS.path),
        clip(body.build, LIMITS.build),
        clip(request.headers.get('User-Agent'), LIMITS.ua),
        clip(body.note, LIMITS.note)
      ),
    // Oldest reports go once the table is full.
    db
      .prepare(
        'DELETE FROM app_reports WHERE id NOT IN (SELECT id FROM app_reports ORDER BY id DESC LIMIT ?)'
      )
      .bind(MAX_STORED),
  ]);
  return json({ sent: true });
}

// Every read or change needs a signed-in account from APP_DEVS.
async function asDev(request, env, url) {
  const body = await request.json().catch(() => undefined);
  const userId = await verifyOpenId(body?.openid);
  if (!userId || !(await devs(env, url)).has(userId.toLowerCase())) return { body, dev: false };
  return { body, dev: true };
}

async function list(request, env, url) {
  const { dev } = await asDev(request, env, url);
  if (!dev) return json({ dev: false });
  const { results } = await env.XP_DB.prepare(
    'SELECT id, at, message, stack, path, build, ua, note FROM app_reports ORDER BY id DESC LIMIT 200'
  ).all();
  return json({ dev: true, reports: results ?? [] });
}

async function resolve(request, env, url) {
  const { body, dev } = await asDev(request, env, url);
  if (!dev) return json({ error: 'not allowed' }, 403);
  if (!Number.isInteger(body?.id)) return json({ error: 'bad id' }, 400);
  await env.XP_DB.prepare('DELETE FROM app_reports WHERE id = ?').bind(body.id).run();
  return json({ deleted: true });
}

export async function handleReports(request, env, url) {
  if (!env.XP_DB) return json({ error: 'not set up' }, 501);
  await ensureTable(env.XP_DB);
  if (request.method !== 'POST') return json({ error: 'not found' }, 404);
  if (url.pathname === '/api/reports') return submit(request, env);
  if (url.pathname === '/api/reports/list') return list(request, env, url);
  if (url.pathname === '/api/reports/resolve') return resolve(request, env, url);
  return json({ error: 'not found' }, 404);
}

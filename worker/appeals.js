// Ban appeal settings for banned members, who Matrix no longer lets read the server. The bot
// joins servers that turn appeals on and reads the real setting for them.
import { verifyOpenId } from './perks.js';

const SETTINGS_TYPE = 'io.angaara.ban_appeals';
const DEFAULT_APPEALS = 2;
const MAX_APPEALS = 10;
// Short, so a mod's change reaches banned members within a minute.
const CACHE_SECONDS = 60;
const ROOM_RE = /^![\w\-+/=.:]{1,255}$/;

const json = (data, status = 200, extra = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...extra },
  });

// Servers cache identical syncs for a couple of minutes, which would hide a fresh invite; the
// timeout is part of that cache key, and a first sync returns at once whatever it is.
const uncached = () => Date.now() % 1000000;

const hasBot = (env) => !!(env.XP_BOT_TOKEN && env.XP_BOT_HOMESERVER);
const botApi = (env, path, method = 'GET', body) =>
  fetch(`${env.XP_BOT_HOMESERVER.replace(/\/+$/, '')}/_matrix/client/v3${path}`, {
    method,
    headers: { Authorization: `Bearer ${env.XP_BOT_TOKEN}`, 'Content-Type': 'application/json' },
    body: body && JSON.stringify(body),
    signal: AbortSignal.timeout(8000),
  });

const clamp = (n) =>
  Number.isInteger(n) ? Math.min(MAX_APPEALS, Math.max(1, n)) : DEFAULT_APPEALS;

// The setting as the server has it right now; `bot: false` when the bot isn't in that server.
async function readSettings(env, roomId) {
  const res = await botApi(
    env,
    `/rooms/${encodeURIComponent(roomId)}/state/${encodeURIComponent(SETTINGS_TYPE)}/`
  );
  if (res.ok) {
    const content = await res.json().catch(() => ({}));
    return { bot: true, enabled: content?.enabled === true, max: clamp(content?.max) };
  }
  const err = await res.json().catch(() => ({}));
  // In the server but never set: appeals are off.
  if (res.status === 404 && err.errcode === 'M_NOT_FOUND') {
    return { bot: true, enabled: false, max: DEFAULT_APPEALS };
  }
  if (res.status === 403) return { bot: false };
  throw new Error(`${res.status} ${err.errcode ?? ''}`);
}

async function settings(env, roomId, ctx) {
  if (!hasBot(env)) return json({ bot: false });
  const cache = caches.default;
  const key = new Request(`https://appeals.cache/${encodeURIComponent(roomId)}`);
  const hit = await cache.match(key);
  if (hit) return json(await hit.json());
  try {
    const data = await readSettings(env, roomId);
    const stored = new Response(JSON.stringify(data), {
      headers: { 'Cache-Control': `max-age=${CACHE_SECONDS}` },
    });
    ctx?.waitUntil(cache.put(key, stored));
    return json(data);
  } catch {
    return json({ error: 'server unreachable' }, 502);
  }
}

// Whether the bot is already in the room, or was invited there by this user.
async function botInvitedBy(env, roomId, userId) {
  const filter = {
    presence: { types: [] },
    account_data: { types: [] },
    room: {
      rooms: [roomId],
      timeline: { limit: 0 },
      ephemeral: { types: [] },
      account_data: { types: [] },
      state: { types: ['m.room.member'], lazy_load_members: true },
    },
  };
  const res = await botApi(
    env,
    `/sync?timeout=${uncached()}&filter=${encodeURIComponent(JSON.stringify(filter))}`
  );
  if (!res.ok) return false;
  const rooms = (await res.json().catch(() => ({})))?.rooms ?? {};
  if (rooms.join?.[roomId]) return true;
  const events = rooms.invite?.[roomId]?.invite_state?.events ?? [];
  return events.some(
    (e) =>
      e?.type === 'm.room.member' && e?.content?.membership === 'invite' && e?.sender === userId
  );
}

// A mod's app invites the bot, then asks it to join; it only joins rooms it was invited to.
async function join(request, env) {
  if (!hasBot(env)) return json({ error: 'no bot' }, 503);
  const body = await request.json().catch(() => undefined);
  const userId = await verifyOpenId(body?.openid);
  if (!userId) return json({ error: 'not signed in' }, 401);
  const roomId = typeof body?.room === 'string' && ROOM_RE.test(body.room) ? body.room : undefined;
  if (!roomId) return json({ error: 'bad room' }, 400);
  if (!(await botInvitedBy(env, roomId, userId))) return json({ error: 'not invited' }, 403);
  const res = await botApi(env, `/join/${encodeURIComponent(roomId)}`, 'POST', {});
  if (!res.ok) return json({ error: `join failed ${res.status}` }, 502);
  await caches.default.delete(new Request(`https://appeals.cache/${encodeURIComponent(roomId)}`));
  return json({ joined: true });
}

// Who to invite; the app needs the bot's Matrix ID.
async function botId(env) {
  if (!hasBot(env)) return json({ bot: false });
  const res = await botApi(env, '/account/whoami').catch(() => undefined);
  const body = await res?.json().catch(() => ({}));
  if (!res?.ok || typeof body?.user_id !== 'string') return json({ bot: false }, 502);
  return json({ bot: true, userId: body.user_id }, 200, { 'Cache-Control': 'max-age=3600' });
}

export async function handleAppeals(request, env, url, ctx) {
  if (url.pathname === '/api/appeals/join' && request.method === 'POST') return join(request, env);
  if (url.pathname === '/api/appeals/bot' && request.method === 'GET') return botId(env);
  if (url.pathname.startsWith('/api/appeals/settings/') && request.method === 'GET') {
    const roomId = decodeURIComponent(url.pathname.slice('/api/appeals/settings/'.length));
    if (!ROOM_RE.test(roomId)) return json({ error: 'bad room' }, 400);
    return settings(env, roomId, ctx);
  }
  return json({ error: 'not found' }, 404);
}

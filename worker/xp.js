// Experience: the app reports the IDs and times of messages you sent (never their content),
// and this counts at most 1 XP per minute. Needs a D1 binding named XP_DB; see docs/XP.md.
import { verifyOpenId } from './perks.js';
import { isAngaaraSupporter } from './angaara-id.js';

const MINUTE = 60 * 1000;
const DAY = 24 * 60 * MINUTE;
const DAILY_BONUS = 5;
// Reports can only look back this far, so XP can't be banked up from made-up history.
const MAX_AGE = 60 * MINUTE;
const MIN_REPORT_GAP = 30 * 1000;
const MAX_EVENTS = 200;
// At most 300 XP a day (5 hours' worth of minutes, UTC), then the bot says go outside.
const DAILY_MINUTES = 5 * 60;
const CAP_MESSAGE = 'Your daily limit has been reached, this is to ensure that you touch grass 🌱';
const WELCOME_MESSAGE =
  "Welcome to Angaara! 🔥 Glad you're here. Join a few servers, add some friends, and make yourself at home. I'm the Angaara bot, and I'll pop in here now and then.";
// Reporting a message that isn't yours pauses XP for a week.
const CHEAT_PAUSE = 7 * DAY;
const SPOT_CHECKS = 3;
// The bot tries the daily limit DM at most this many times a day.
const MAX_DM_TRIES = 3;

// Launch offer.
const BOOSTS = [
  { upTo: 1000, times: 3, days: 90 },
  { upTo: 100000, times: 1.5, days: 30 },
];
// Boosts count from here at the earliest, so people who joined before the offer still get theirs.
const BOOST_START = Date.UTC(2026, 8, 28);

// XP needed for each level; keep in sync with XP_LEVELS in src/client/xp.ts.
const LEVELS = [2000, 10000, 30000, 50000, 80000];
const levelOf = (xp) => LEVELS.filter((need) => xp >= need).length;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
};

const json = (data, status = 200, extra = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...CORS, ...extra },
  });

const MXID_RE = /^@[a-z0-9._=\-/+]{1,255}:[a-z0-9.-]{1,253}(:\d{1,5})?$/i;
const EVENT_RE = /^\$(?:[A-Za-z0-9+/_-]{43}|[^:\s]{1,200}:[a-z0-9.-]{1,253}(?::\d{1,5})?)$/;
const ROOM_RE = /^![\w\-+/=.:]{1,255}$/;

// Columns added after launch; adding one that already exists just fails and is ignored.
const ADDED_COLUMNS = [
  'cap_day INTEGER NOT NULL DEFAULT 0',
  'cap_minutes INTEGER NOT NULL DEFAULT 0',
  'notified_day INTEGER NOT NULL DEFAULT 0',
  'dm_room TEXT',
  'dm_status TEXT',
  'dm_day INTEGER NOT NULL DEFAULT 0',
  'dm_tries INTEGER NOT NULL DEFAULT 0',
  'paused_until INTEGER NOT NULL DEFAULT 0',
  'welcomed INTEGER NOT NULL DEFAULT 0',
  'member_no INTEGER',
];

const assignMemberNumbers = (db) =>
  db
    .prepare(
      `UPDATE xp SET member_no = numbered.n FROM (
         SELECT user_id,
           ROW_NUMBER() OVER (ORDER BY first_seen, user_id)
             + (SELECT COALESCE(MAX(member_no), 0) FROM xp) AS n
         FROM xp WHERE member_no IS NULL
       ) AS numbered
       WHERE xp.user_id = numbered.user_id`
    )
    .run();

const boostFor = (memberNo, firstSeen, now) => {
  const offer = memberNo ? BOOSTS.find((b) => memberNo <= b.upTo) : undefined;
  if (!offer) return undefined;
  const until = Math.max(firstSeen ?? now, BOOST_START) + offer.days * DAY;
  return until > now ? { times: offer.times, until } : undefined;
};

// Rounds up or down at random by the fraction, so 1.5x averages out to exactly 1.5x.
const boosted = (xp, times) => {
  const exact = xp * times;
  return Math.floor(exact) + (Math.random() < exact % 1 ? 1 : 0);
};

let tableReady;
const ensureTable = (db) => {
  tableReady ??= (async () => {
    await db
      .prepare(
        `CREATE TABLE IF NOT EXISTS xp (
          user_id TEXT PRIMARY KEY,
          xp INTEGER NOT NULL DEFAULT 0,
          last_award INTEGER NOT NULL DEFAULT 0,
          last_day INTEGER NOT NULL DEFAULT 0,
          last_report INTEGER NOT NULL DEFAULT 0,
          first_seen INTEGER NOT NULL
        )`
      )
      .run();
    // Server levels are counted in the app now; the old activity tables go.
    await db.batch([
      db.prepare('DROP TABLE IF EXISTS space_member'),
      db.prepare('DROP TABLE IF EXISTS space_age'),
    ]);
    await Promise.all(
      ADDED_COLUMNS.map((col) =>
        db
          .prepare(`ALTER TABLE xp ADD COLUMN ${col}`)
          .run()
          .catch(() => undefined)
      )
    );
    await db.prepare('CREATE UNIQUE INDEX IF NOT EXISTS xp_member_no ON xp (member_no)').run();
    await assignMemberNumbers(db);
  })().catch((err) => {
    tableReady = undefined;
    throw err;
  });
  return tableReady;
};

// Servers cache identical syncs for a couple of minutes, which would hide a fresh invite; the
// timeout is part of that cache key, and a first sync returns at once whatever it is.
const uncached = () => Date.now() % 1000000;

const botBase = (env) => env.XP_BOT_HOMESERVER.replace(/\/+$/, '');

// DMs the user from the bot account; needs the XP_BOT_* secrets. Prefers the room their app made
// and invited the bot to, then the last room used, then a fresh invite. Returns what happened.
async function dmUser(env, userId, room, ownRoom, message = CAP_MESSAGE) {
  if (!env.XP_BOT_TOKEN || !env.XP_BOT_HOMESERVER) return { room, status: 'no bot' };
  const api = (path, method, body) =>
    fetch(`${botBase(env)}/_matrix/client/v3${path}`, {
      method,
      headers: { Authorization: `Bearer ${env.XP_BOT_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(8000),
    });
  const why = async (res) => {
    const err = await res.json().catch(() => ({}));
    return `${res.status} ${err.errcode ?? ''} ${err.error ?? ''}`.trim().slice(0, 160);
  };
  const send = (roomId) =>
    api(`/rooms/${encodeURIComponent(roomId)}/send/m.room.message/xp-${Date.now()}`, 'PUT', {
      msgtype: 'm.text',
      body: message,
    });
  // Whether this user invited the bot to the room, so it never joins rooms it wasn't asked into.
  const invitedBy = async (roomId) => {
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
    const res = await api(
      `/sync?timeout=${uncached()}&filter=${encodeURIComponent(JSON.stringify(filter))}`,
      'GET'
    );
    if (!res.ok) return false;
    const rooms = (await res.json().catch(() => ({})))?.rooms ?? {};
    if (rooms.join?.[roomId]) return true;
    const events = rooms.invite?.[roomId]?.invite_state?.events ?? [];
    return events.some(
      (e) =>
        e?.type === 'm.room.member' && e?.content?.membership === 'invite' && e?.sender === userId
    );
  };
  // Their room is only used if it's just them and the bot, and unencrypted (the bot can't encrypt).
  const joinOwnRoom = async (roomId) => {
    const path = `/rooms/${encodeURIComponent(roomId)}`;
    if (!(await invitedBy(roomId))) return false;
    if (!(await api(`/join/${encodeURIComponent(roomId)}`, 'POST', {})).ok) return false;
    const members = await api(`${path}/joined_members`, 'GET')
      .then((res) => res.json())
      .catch(() => ({}));
    const joined = Object.keys(members?.joined ?? {});
    const encrypted = (await api(`${path}/state/m.room.encryption/`, 'GET')).ok;
    if (joined.length === 2 && joined.includes(userId) && !encrypted) return true;
    await api(`${path}/leave`, 'POST', {});
    return false;
  };
  try {
    if (ownRoom && ownRoom !== room && (await joinOwnRoom(ownRoom))) {
      const res = await send(ownRoom);
      if (res.ok) return { room: ownRoom, status: 'sent' };
    }
    if (room) {
      const res = await send(room);
      if (res.ok) return { room, status: 'sent' };
    }
    const res = await api('/createRoom', 'POST', {
      is_direct: true,
      preset: 'trusted_private_chat',
      invite: [userId],
      name: 'Angaara',
    });
    if (!res.ok) return { room, status: `createRoom ${await why(res)}` };
    const created = (await res.json())?.room_id;
    const sent = await send(created);
    return { room: created, status: sent.ok ? 'sent' : `send ${await why(sent)}` };
  } catch (err) {
    return { room, status: `failed ${String(err).slice(0, 120)}` };
  }
}

// With a bot token set, spot-check a few reported messages: any the bot can see must be yours.
// Returns false only when one provably isn't; rooms the bot isn't in can't be checked.
async function spotCheck(env, userId, events) {
  if (!env.XP_BOT_TOKEN || !env.XP_BOT_HOMESERVER || events.length === 0) return true;
  const picks = [...events].sort(() => Math.random() - 0.5).slice(0, SPOT_CHECKS);
  const check = async (ev) => {
    const url = `${botBase(env)}/_matrix/client/v3/rooms/${encodeURIComponent(
      ev.room_id
    )}/event/${encodeURIComponent(ev.event_id)}`;
    try {
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${env.XP_BOT_TOKEN}` },
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) return true;
      return (await res.json())?.sender === userId;
    } catch {
      return true;
    }
  };
  return (await Promise.all(picks.map(check))).every(Boolean);
}

async function report(request, env) {
  const body = await request.json().catch(() => undefined);
  const userId = await verifyOpenId(body?.openid);
  if (!userId) return json({ error: 'not signed in' }, 401);

  const now = Date.now();
  const row = await env.XP_DB.prepare('SELECT * FROM xp WHERE user_id = ?').bind(userId).first();
  if (row && now - row.last_report < MIN_REPORT_GAP) return json({ error: 'too soon' }, 429);
  if (row && row.paused_until > now) {
    return json({ error: 'paused', until: row.paused_until }, 403);
  }
  // Claim this report first, so two at once can't both get through.
  const claim = row
    ? await env.XP_DB.prepare(
        'UPDATE xp SET last_report = ?1 WHERE user_id = ?2 AND last_report = ?3'
      )
        .bind(now, userId, row.last_report)
        .run()
    : await env.XP_DB.prepare(
        'INSERT INTO xp (user_id, last_report, first_seen) VALUES (?1, ?2, ?2) ON CONFLICT DO NOTHING'
      )
        .bind(userId, now)
        .run();
  if (!claim.meta?.changes) return json({ error: 'too soon' }, 429);
  if (!row) await assignMemberNumbers(env.XP_DB);
  const member =
    row ??
    (await env.XP_DB.prepare('SELECT member_no, first_seen FROM xp WHERE user_id = ?')
      .bind(userId)
      .first());
  const lastAward = row?.last_award ?? 0;
  const ownRoom =
    typeof body?.dm_room === 'string' && ROOM_RE.test(body.dm_room) ? body.dm_room : undefined;
  // Messages in the XP DM don't count; there's nobody there to talk to.
  const xpRooms = [row?.dm_room, ownRoom];
  const ids = new Set();
  const events = (Array.isArray(body?.events) ? body.events : [])
    .slice(0, MAX_EVENTS)
    .filter(
      (e) =>
        !ids.has(e?.event_id) &&
        ids.add(e?.event_id) &&
        typeof e?.event_id === 'string' &&
        EVENT_RE.test(e.event_id) &&
        typeof e?.room_id === 'string' &&
        ROOM_RE.test(e.room_id) &&
        !xpRooms.includes(e.room_id) &&
        Number.isFinite(e?.ts) &&
        e.ts > Math.max(lastAward, now - MAX_AGE) &&
        e.ts <= now + MINUTE
    );
  if (!(await spotCheck(env, userId, events))) {
    const until = now + CHEAT_PAUSE;
    await env.XP_DB.prepare('UPDATE xp SET paused_until = ?1 WHERE user_id = ?2')
      .bind(until, userId)
      .run();
    // eslint-disable-next-line no-console
    console.warn(`xp: paused ${userId} for reporting a message that isn't theirs`);
    return json({ error: 'paused', until }, 403);
  }

  // One XP per minute that had a message, never for a minute already counted.
  const lastMinute = Math.floor(lastAward / MINUTE);
  const minutes = [
    ...new Set(
      events.map((e) => Math.floor(Math.min(e.ts, now) / MINUTE)).filter((m) => m > lastMinute)
    ),
  ].sort((a, b) => a - b);
  const today = Math.floor(now / DAY);
  const usedToday = row?.cap_day === today ? row.cap_minutes : 0;
  const counted = Math.min(minutes.length, Math.max(0, DAILY_MINUTES - usedToday));
  let gained = counted;
  if (counted > 0 && today > (row?.last_day ?? 0)) gained += DAILY_BONUS;
  const boost = boostFor(member?.member_no, member?.first_seen, now);
  if (boost) gained = boosted(gained, boost.times);
  // Minutes past the cap are still marked seen, so they can't be claimed later.
  const newestMinute = minutes.length > 0 ? minutes[minutes.length - 1] : lastMinute;
  const capMinutes = usedToday + counted;
  const capped = capMinutes >= DAILY_MINUTES;

  let dmRoom = row?.dm_room ?? null;
  let notifiedDay = row?.notified_day ?? 0;
  let dmStatus = row?.dm_status ?? null;
  let dmTries = row?.dm_day === today ? row.dm_tries : 0;
  if (capped && notifiedDay !== today && dmTries < MAX_DM_TRIES) {
    dmTries += 1;
    const dm = await dmUser(env, userId, dmRoom, ownRoom);
    dmRoom = dm.room ?? null;
    dmStatus = dm.status;
    // Only a delivered DM counts; otherwise the next report tries again.
    if (dm.status === 'sent') notifiedDay = today;
  }

  // Adds to the stored total rather than overwriting it, in case a slow report overlaps another.
  const saved = await env.XP_DB.prepare(
    `INSERT INTO xp (user_id, xp, last_award, last_day, last_report, first_seen,
                     cap_day, cap_minutes, notified_day, dm_room, dm_status, dm_day, dm_tries)
     VALUES (?1, ?2, ?3, ?4, ?5, ?5, ?6, ?7, ?8, ?9, ?10, ?6, ?11)
     ON CONFLICT(user_id) DO UPDATE SET
       xp = xp + ?2, last_award = ?3, last_day = ?4, last_report = ?5,
       cap_day = ?6, cap_minutes = ?7, notified_day = ?8, dm_room = ?9, dm_status = ?10,
       dm_day = ?6, dm_tries = ?11
     RETURNING xp`
  )
    .bind(
      userId,
      gained,
      Math.max(lastAward, newestMinute * MINUTE),
      counted > 0 ? today : row?.last_day ?? 0,
      now,
      today,
      capMinutes,
      notifiedDay,
      dmRoom,
      dmStatus,
      dmTries
    )
    .first();
  const xp = saved?.xp ?? (row?.xp ?? 0) + gained;
  return json({ xp, level: levelOf(xp), gained, capped, boost, dm: capped ? dmStatus : undefined });
}

// Whether the bot secrets are set and its login still works; never shows the token.
async function botStatus(env) {
  if (!env.XP_BOT_TOKEN || !env.XP_BOT_HOMESERVER) return json({ configured: false });
  try {
    const res = await fetch(`${botBase(env)}/_matrix/client/v3/account/whoami`, {
      headers: { Authorization: `Bearer ${env.XP_BOT_TOKEN}` },
      signal: AbortSignal.timeout(8000),
    });
    const body = await res.json().catch(() => ({}));
    return json({ configured: true, ok: res.ok, userId: body.user_id, error: body.errcode });
  } catch (err) {
    return json({ configured: true, ok: false, error: String(err).slice(0, 120) });
  }
}

async function welcome(request, env) {
  const body = await request.json().catch(() => undefined);
  const userId = await verifyOpenId(body?.openid);
  if (!userId) return json({ error: 'not signed in' }, 401);
  const ownRoom =
    typeof body?.dm_room === 'string' && ROOM_RE.test(body.dm_room) ? body.dm_room : undefined;

  await env.XP_DB.prepare(
    'INSERT INTO xp (user_id, first_seen) VALUES (?1, ?2) ON CONFLICT DO NOTHING'
  )
    .bind(userId, Date.now())
    .run();
  await assignMemberNumbers(env.XP_DB);
  // Claim it first so two tabs can't both send it.
  const claim = await env.XP_DB.prepare(
    'UPDATE xp SET welcomed = 1 WHERE user_id = ?1 AND welcomed = 0'
  )
    .bind(userId)
    .run();
  if (!claim.meta?.changes) return json({ status: 'already sent' });

  const row = await env.XP_DB.prepare('SELECT dm_room FROM xp WHERE user_id = ?')
    .bind(userId)
    .first();
  const dm = await dmUser(env, userId, row?.dm_room, ownRoom, WELCOME_MESSAGE);
  await env.XP_DB.prepare('UPDATE xp SET welcomed = ?1, dm_room = ?2 WHERE user_id = ?3')
    .bind(dm.status === 'sent' ? 1 : 0, dm.room ?? null, userId)
    .run();
  return json({ status: dm.status });
}

// Everything the XP counter keeps on someone, plus the bot leaving its DM with them.
export async function deleteXpData(env, userId) {
  if (!env.XP_DB) return;
  await ensureTable(env.XP_DB);
  const row = await env.XP_DB.prepare('SELECT dm_room FROM xp WHERE user_id = ?')
    .bind(userId)
    .first();
  await env.XP_DB.prepare('DELETE FROM xp WHERE user_id = ?').bind(userId).run();
  if (!row?.dm_room || !env.XP_BOT_TOKEN || !env.XP_BOT_HOMESERVER) return;
  const room = `${botBase(env)}/_matrix/client/v3/rooms/${encodeURIComponent(row.dm_room)}`;
  const headers = {
    Authorization: `Bearer ${env.XP_BOT_TOKEN}`,
    'Content-Type': 'application/json',
  };
  await fetch(`${room}/leave`, { method: 'POST', headers, body: '{}' }).catch(() => undefined);
  await fetch(`${room}/forget`, { method: 'POST', headers, body: '{}' }).catch(() => undefined);
}

async function remove(request, env) {
  const body = await request.json().catch(() => undefined);
  const userId = await verifyOpenId(body?.openid);
  if (!userId) return json({ error: 'not signed in' }, 401);
  await deleteXpData(env, userId);
  return json({ deleted: true });
}

export async function handleXp(request, env, url) {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (!env.XP_DB) return json({ error: 'not set up' }, 501);
  await ensureTable(env.XP_DB);

  if (url.pathname === '/api/xp/report' && request.method === 'POST') return report(request, env);
  if (url.pathname === '/api/xp/delete' && request.method === 'POST') return remove(request, env);
  if (url.pathname === '/api/xp/welcome' && request.method === 'POST') return welcome(request, env);
  if (url.pathname === '/api/xp/bot' && request.method === 'GET') return botStatus(env);

  const user = url.pathname.startsWith('/api/xp/user/')
    ? decodeURIComponent(url.pathname.slice('/api/xp/user/'.length))
    : undefined;
  if (user !== undefined && request.method === 'GET') {
    if (!MXID_RE.test(user)) return json({ error: 'bad user' }, 400);
    const row = await env.XP_DB.prepare(
      'SELECT xp, first_seen, cap_day, cap_minutes, member_no FROM xp WHERE user_id = ?'
    )
      .bind(user)
      .first();
    const xp = row?.xp ?? 0;
    const now = Date.now();
    const today = Math.floor(now / DAY);
    const minutesToday = row?.cap_day === today ? row.cap_minutes : 0;
    const body = {
      xp,
      level: levelOf(xp),
      since: row?.first_seen,
      minutesToday,
      member: row?.member_no ?? undefined,
      boost: row ? boostFor(row.member_no, row.first_seen, now) : undefined,
      supporter: (await isAngaaraSupporter(env, user).catch(() => false)) || undefined,
    };
    return json({ ...body, capped: minutesToday >= DAILY_MINUTES }, 200, {
      'Cache-Control': 'public, max-age=60',
    });
  }
  return json({ error: 'not found' }, 404);
}

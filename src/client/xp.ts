import { EventStatus, MatrixClient, MatrixEvent, Preset, Room, RoomEvent } from 'matrix-js-sdk';
import { setDirectRoom } from './directs';

// XP needed for each level; keep in sync with worker/xp.js.
export const XP_LEVELS = [2000, 10000, 30000, 50000, 80000];
// What each level unlocks; the last one is everything.
export const XP_LEVEL_REWARDS = [
  'Animated panel background',
  'Animated profile banner',
  'Profile colours',
  'More perks soon',
  'Full access',
];

// XP each perk needs.
export const XP_PERKS = {
  panelGif: XP_LEVELS[0],
  bannerGif: XP_LEVELS[1],
  profileTheme: XP_LEVELS[2],
};
export type XpPerk = keyof typeof XP_PERKS;
export const xpLevel = (xp: number) => XP_LEVELS.filter((need) => xp >= need).length;

export type XpStatus = {
  xp: number;
  level: number;
  since?: number;
  // Minutes counted today (UTC), up to the daily limit.
  minutesToday?: number;
  capped?: boolean;
};
// Most XP a day (one per minute with a message, so 5 hours' worth); matches worker/xp.js.
export const XP_DAILY_MINUTES = 5 * 60;

// Same-origin Worker endpoints, so the XP counter moves with the domain.
export const xpApi = (path: string) => `${window.location.origin}/api/xp/${path}`;

const FLUSH_EVERY = 2 * 60 * 1000;
const MAX_QUEUE = 200;
const COUNTED_TYPES = ['m.room.message', 'm.room.encrypted', 'm.sticker'];

type Sent = { room_id: string; event_id: string; ts: number };

// What the last report did, shown in settings so problems are visible.
export type XpReportInfo = { at: number; queued: number; result: string };
let lastReport: XpReportInfo | undefined;
export const getLastXpReport = () => lastReport;
const note = (queued: number, result: string) => {
  lastReport = { at: Date.now(), queued, result };
};

// Where the XP bot writes to you: a room you own and invite it to, so nothing needs accepting.
export const XP_ROOM_KEY = 'io.angaara.xp_room';
let xpRoomTask: Promise<string | undefined> | undefined;

const savedXpRoom = (mx: MatrixClient) =>
  (mx.getAccountData(XP_ROOM_KEY as never)?.getContent() as { room_id?: string } | undefined)
    ?.room_id;

const makeXpRoom = async (mx: MatrixClient): Promise<string | undefined> => {
  const saved = savedXpRoom(mx);
  if (saved && mx.getRoom(saved)?.getMyMembership() === 'join') return saved;

  const bot = await fetch(xpApi('bot'))
    .then((res) => res.json())
    .catch(() => undefined);
  if (!bot?.ok || typeof bot.userId !== 'string') return undefined;
  // Left unencrypted on purpose: the bot posts from the Worker and can't encrypt.
  const { room_id: roomId } = await mx.createRoom({
    preset: Preset.PrivateChat,
    is_direct: true,
    name: 'Angaara',
    invite: [bot.userId],
  });
  await mx.setAccountData(XP_ROOM_KEY as never, { room_id: roomId } as never);
  await setDirectRoom(mx, roomId, bot.userId).catch(() => undefined);
  return roomId;
};

// Made once, the first time it's needed.
const ensureXpRoom = (mx: MatrixClient) => {
  xpRoomTask ??= makeXpRoom(mx).catch(() => {
    xpRoomTask = undefined;
    return undefined;
  });
  return xpRoomTask;
};

// Servers you're in, so you count toward their server level; only you can add yourself.
const joinedSpaces = (mx: MatrixClient) =>
  mx
    .getRooms()
    .filter((room: Room) => room.isSpaceRoom() && room.getMyMembership() === 'join')
    .slice(0, 50)
    .map((room: Room) => ({
      id: room.roomId,
      created: room.currentState.getStateEvents('m.room.create', '')?.getTs(),
    }));

// Asks the bot for its one-time welcome DM; the Worker makes sure it's only ever sent once.
export const requestWelcomeDm = async (mx: MatrixClient): Promise<string | undefined> => {
  const dmRoom = await ensureXpRoom(mx);
  const res = await fetch(xpApi('welcome'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ openid: await mx.getOpenIdToken(), dm_room: dmRoom }),
  });
  const data = await res.json().catch(() => ({}));
  return typeof data?.status === 'string' ? data.status : undefined;
};

// Only message IDs and send times leave the device, never what the messages say.
export const startXpReporter = (mx: MatrixClient, onUnavailable: () => void): (() => void) => {
  let queue: Sent[] = [];
  const seen = new Set<string>();
  let token: { body: unknown; until: number } | undefined;
  let busy = false;

  const openId = async () => {
    if (token && token.until > Date.now()) return token.body;
    const t = await mx.getOpenIdToken();
    token = { body: t, until: Date.now() + (t.expires_in - 60) * 1000 };
    return t;
  };

  const flush = async () => {
    if (busy || queue.length === 0) return;
    busy = true;
    const batch = queue;
    queue = [];
    try {
      const res = await fetch(xpApi('report'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          openid: await openId(),
          events: batch,
          dm_room: await ensureXpRoom(mx),
          spaces: joinedSpaces(mx),
        }),
        keepalive: true,
      });
      const data = await res.json().catch(() => ({}));
      const dm = typeof data?.dm === 'string' ? ` · limit DM: ${data.dm}` : '';
      const paused =
        data?.error === 'paused'
          ? ` · XP paused until ${new Date(data.until).toLocaleString()}`
          : '';
      note(batch.length, res.ok ? `sent${dm}` : `error ${res.status}${paused}`);
      if (res.status === 501) onUnavailable();
      // Try again next time unless the server refused the batch outright.
      else if (res.status === 429 || res.status >= 500) queue = [...batch, ...queue];
    } catch (err) {
      note(batch.length, `failed: ${err instanceof Error ? err.message : 'network'}`);
      queue = [...batch, ...queue];
    } finally {
      queue = queue.slice(-MAX_QUEUE);
      busy = false;
    }
  };

  // Counted once the server accepts it; on fast servers the sync copy can land before the reply.
  const onEcho = (
    event: MatrixEvent,
    room: Room,
    oldEventId?: string,
    oldStatus?: EventStatus | null
  ) => {
    const id = event.getId();
    const sent = event.status === EventStatus.SENT || (event.status === null && !!oldStatus);
    if (!sent || !id?.startsWith('$') || seen.has(id)) return;
    if (event.getSender() !== mx.getUserId() || !COUNTED_TYPES.includes(event.getType())) return;
    // Talking to yourself doesn't count: only rooms with someone else in them, never the XP DM.
    if (room.getJoinedMemberCount() < 2 || room.roomId === savedXpRoom(mx)) return;
    seen.add(id);
    queue.push({ room_id: room.roomId, event_id: id, ts: Date.now() });
    note(queue.length, 'waiting to send');
    queue = queue.slice(-MAX_QUEUE);
  };

  const onHide = () => {
    if (document.visibilityState === 'hidden') flush();
  };

  note(0, 'running');
  mx.on(RoomEvent.LocalEchoUpdated, onEcho);
  document.addEventListener('visibilitychange', onHide);
  const timer = window.setInterval(flush, FLUSH_EVERY);
  return () => {
    mx.removeListener(RoomEvent.LocalEchoUpdated, onEcho);
    document.removeEventListener('visibilitychange', onHide);
    window.clearInterval(timer);
    flush();
  };
};

export const deleteXp = async (mx: MatrixClient): Promise<boolean> => {
  const res = await fetch(xpApi('delete'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ openid: await mx.getOpenIdToken() }),
  });
  return res.ok;
};

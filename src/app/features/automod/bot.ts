import { MatrixClient, Room } from 'matrix-js-sdk';
import { RoomToParents, StateEvent } from '../../../types/matrix/room';
import { getStateEvents } from '../../utils/room';
import { isPrivateMode, PRIVATE_MODE_MESSAGE } from '../../utils/privateMode';

const trim = (url: string) => url.replace(/\/+$/, '');

const botIds = new Map<string, string>();

// The bot only answers signed-in Matrix users, so strangers opening its URL get a 403.
export const getBotUserId = async (
  mx: MatrixClient,
  botUrl: string
): Promise<string | undefined> => {
  if (isPrivateMode()) return undefined;
  const cached = botIds.get(botUrl);
  if (cached) return cached;
  const openid = await mx.getOpenIdToken().catch(() => undefined);
  if (!openid) return undefined;
  const res = await fetch(`${trim(botUrl)}/api/status`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ openid }),
  }).catch(() => undefined);
  const data = await res?.json().catch(() => undefined);
  if (typeof data?.bot !== 'string') return undefined;
  botIds.set(botUrl, data.bot);
  return data.bot;
};

export const serverRooms = (mx: MatrixClient, space: Room): Room[] => {
  const found = new Map<string, Room>([[space.roomId, space]]);
  const walk = (room: Room) =>
    getStateEvents(room, StateEvent.SpaceChild).forEach((ev) => {
      const child = mx.getRoom(ev.getStateKey());
      if (!child || found.has(child.roomId) || child.getMyMembership() !== 'join') return;
      found.set(child.roomId, child);
      if (child.isSpaceRoom()) walk(child);
    });
  walk(space);
  return Array.from(found.values());
};

const botIn = (room: Room, botId: string) =>
  ['join', 'invite'].includes(room.getMember(botId)?.membership ?? '');

type BotResult = { joined: string[]; failed: string[] };

const post = async (url: string, body: unknown): Promise<Record<string, unknown>> => {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok)
    throw new Error(typeof data.error === 'string' ? data.error : `Bot error ${res.status}`);
  return data;
};

export const enableBot = async (
  mx: MatrixClient,
  botUrl: string,
  space: Room,
  roomToParents: RoomToParents
): Promise<BotResult> => {
  if (isPrivateMode()) throw new Error(PRIVATE_MODE_MESSAGE);
  const botId = await getBotUserId(mx, botUrl);
  if (!botId) throw new Error("The Angaara Bot isn't reachable right now.");
  const rooms = serverRooms(mx, space);
  const me = mx.getSafeUserId();

  // eslint-disable-next-line no-restricted-syntax
  for (const room of rooms) {
    // eslint-disable-next-line no-await-in-loop
    if (!botIn(room, botId)) await mx.invite(room.roomId, botId).catch(() => undefined);
    if (!room.isSpaceRoom()) {
      const pl = room.currentState.getStateEvents('m.room.power_levels', '')?.getContent() ?? {};
      const need = Math.max(typeof pl.redact === 'number' ? pl.redact : 50, 50);
      const has = pl.users?.[botId] ?? pl.users_default ?? 0;
      if (has < need && room.currentState.maySendStateEvent('m.room.power_levels', me)) {
        // eslint-disable-next-line no-await-in-loop
        await mx.setPowerLevel(room.roomId, botId, need).catch(() => undefined);
      }
    }
  }

  const ids = new Set(rooms.map((r) => r.roomId));
  const data = await post(`${trim(botUrl)}/api/join`, {
    openid: await mx.getOpenIdToken(),
    rooms: rooms.map((r) => ({
      id: r.roomId,
      parents: Array.from(roomToParents.get(r.roomId) ?? []).filter((p) => ids.has(p)),
    })),
  });
  return {
    joined: Array.isArray(data.joined) ? (data.joined as string[]) : [],
    failed: Array.isArray(data.failed) ? (data.failed as string[]) : [],
  };
};

export const disableBot = async (mx: MatrixClient, botUrl: string, space: Room): Promise<void> => {
  await post(`${trim(botUrl)}/api/leave`, {
    openid: await mx.getOpenIdToken(),
    rooms: serverRooms(mx, space).map((r) => ({ id: r.roomId })),
  });
};

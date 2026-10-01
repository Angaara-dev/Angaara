import { MatrixClient, Room } from 'matrix-js-sdk';
import { RoomToParents, StateEvent } from '../../../types/matrix/room';
import { getAllParents, getStateEvent, getStateEvents } from '../../utils/room';
import { readAutoMod } from './automod';
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

type PowerLevels = {
  users?: Record<string, number>;
  users_default?: number;
  redact?: number;
  ban?: number;
  kick?: number;
  invite?: number;
};

// Removing messages needs redact power; commands also need ban, kick and invite power, in
// categories too, so bans cover the whole server.
const botLevel = (pl: PowerLevels, space: boolean, commands: boolean): number => {
  const level = (v: number | undefined, fallback: number) => (typeof v === 'number' ? v : fallback);
  const redact = space ? 0 : Math.max(level(pl.redact, 50), 50);
  if (!commands) return redact;
  return Math.max(redact, level(pl.ban, 50), level(pl.kick, 50), level(pl.invite, 0), 50);
};

// Raises the bot to what it needs; lowering is only for turning commands off.
const setBotPower = async (
  mx: MatrixClient,
  roomId: string,
  botId: string,
  space: boolean,
  commands: boolean,
  lower = false
) => {
  const pl = ((await mx.getStateEvent(roomId, 'm.room.power_levels', '').catch(() => undefined)) ??
    {}) as PowerLevels;
  const need = botLevel(pl, space, commands);
  const has = pl.users?.[botId] ?? pl.users_default ?? 0;
  if (has < need || (lower && has > need)) {
    await mx.setPowerLevel(roomId, botId, need).catch(() => undefined);
  }
};

// Bot settings for a server, read from the space and every space above it.
export const serverBotSettings = (
  mx: MatrixClient,
  roomToParents: RoomToParents,
  spaceId: string
): { bot: boolean; commands: boolean } => {
  const all = [spaceId, ...getAllParents(roomToParents, spaceId)].flatMap((id) => {
    const space = mx.getRoom(id);
    const event = space && getStateEvent(space, StateEvent.AngaaraAutoMod);
    return event ? [readAutoMod(event.getContent())] : [];
  });
  return { bot: all.some((r) => r.bot), commands: all.some((r) => r.commands) };
};

const askToJoin = async (
  mx: MatrixClient,
  botUrl: string,
  rooms: { id: string; parents: string[] }[]
): Promise<BotResult> => {
  const data = await post(`${trim(botUrl)}/api/join`, {
    openid: await mx.getOpenIdToken(),
    rooms,
  });
  return {
    joined: Array.isArray(data.joined) ? (data.joined as string[]) : [],
    failed: Array.isArray(data.failed) ? (data.failed as string[]) : [],
  };
};

export const enableBot = async (
  mx: MatrixClient,
  botUrl: string,
  space: Room,
  roomToParents: RoomToParents,
  commands: boolean,
  lower = false
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
    if (room.currentState.maySendStateEvent('m.room.power_levels', me)) {
      // eslint-disable-next-line no-await-in-loop
      await setBotPower(mx, room.roomId, botId, room.isSpaceRoom(), commands, lower);
    }
  }

  const ids = new Set(rooms.map((r) => r.roomId));
  return askToJoin(
    mx,
    botUrl,
    rooms.map((r) => ({
      id: r.roomId,
      parents: Array.from(roomToParents.get(r.roomId) ?? []).filter((p) => ids.has(p)),
    }))
  );
};

// Channels and categories made after the bot was turned on get it straight away.
export const addBotToNewRoom = async (
  mx: MatrixClient,
  botUrl: string | undefined,
  roomId: string,
  parent: Room,
  roomToParents: RoomToParents,
  space: boolean
): Promise<void> => {
  if (!botUrl || isPrivateMode()) return;
  const settings = serverBotSettings(mx, roomToParents, parent.roomId);
  if (!settings.bot) return;
  const botId = await getBotUserId(mx, botUrl);
  if (!botId) return;
  await mx.invite(roomId, botId);
  await setBotPower(mx, roomId, botId, space, settings.commands);
  const rooms = [{ id: roomId, parents: [parent.roomId] }];
  const { failed } = await askToJoin(mx, botUrl, rooms);
  // The invite can take a moment to reach the bot's homeserver.
  if (failed.length > 0) {
    await new Promise((resolve) => {
      setTimeout(resolve, 3000);
    });
    await askToJoin(mx, botUrl, rooms);
  }
};

export const disableBot = async (mx: MatrixClient, botUrl: string, space: Room): Promise<void> => {
  await post(`${trim(botUrl)}/api/leave`, {
    openid: await mx.getOpenIdToken(),
    rooms: serverRooms(mx, space).map((r) => ({ id: r.roomId })),
  });
};

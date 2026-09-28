import { MatrixClient, MatrixEvent, Room } from 'matrix-js-sdk';
import { Membership } from '../../../types/matrix/room';
import { getRoomCreators, getRoomCreatorsForRoomId } from '../../hooks/useRoomCreators';

// State in an appeal room, which a banned user opens with the people who can unban them.
export const APPEAL_STATE = 'io.angaara.appeal';
// Account data counting the appeals used per server, so each ban gets two tries.
const APPEALS_USED_KEY = 'io.angaara.appeals';
export const MAX_APPEALS = 2;

export type AppealStatus = 'open' | 'denied' | 'accepted' | 'closed';
export type AppealContent = {
  space: string;
  space_name: string;
  attempt: number;
  status: AppealStatus;
};

export type Mod = { id: string; name: string };

// People with the power to ban and unban here (plus creators).
export const getMods = (mx: MatrixClient, room: Room | null): Mod[] => {
  if (!room) return [];
  const myId = mx.getSafeUserId();
  const pl = room.currentState.getStateEvents('m.room.power_levels', '')?.getContent() ?? {};
  const need = pl.ban ?? 50;
  const ids = new Set(getRoomCreatorsForRoomId(mx, room.roomId));
  Object.entries<number>(pl.users ?? {}).forEach(([id, level]) => {
    if (level >= need) ids.add(id);
  });
  ids.delete(myId);
  return [...ids].slice(0, 8).map((id) => ({ id, name: room.getMember(id)?.name ?? id }));
};

export const getAppeal = (room: Room): AppealContent | undefined => {
  const content = room.currentState.getStateEvents(APPEAL_STATE, '')?.getContent();
  return content?.space ? (content as AppealContent) : undefined;
};

// Opens the ban notice from elsewhere, e.g. an Appeal button on a server card.
export const BAN_NOTICE_EVENT = 'angaara:ban-notice';
export type BanNoticeDetail = { roomIdOrAlias: string; name?: string };
export const openBanNotice = (detail: BanNoticeDetail) =>
  window.dispatchEvent(new CustomEvent(BAN_NOTICE_EVENT, { detail }));

export const isBanError = (e: unknown) =>
  !!e && typeof e === 'object' && /banned/i.test(String((e as { message?: string }).message));

// Servers forget banned members fast, so each joined room's name and mods are kept here.
const REMEMBERED_KEY = 'angaara_room_mods';
type Remembered = Record<string, { name: string; mods: Mod[] }>;
const recallAll = (): Remembered => {
  try {
    return JSON.parse(localStorage.getItem(REMEMBERED_KEY) ?? '{}');
  } catch {
    return {};
  }
};
export const rememberRooms = (mx: MatrixClient) => {
  const all: Remembered = {};
  mx.getRooms().forEach((room: Room) => {
    if (room.getMyMembership() !== Membership.Join || getAppeal(room)) return;
    const mods = getMods(mx, room);
    if (mods.length > 0) all[room.roomId] = { name: room.name, mods };
  });
  try {
    // Keep what we knew about rooms we've since left or been banned from.
    localStorage.setItem(REMEMBERED_KEY, JSON.stringify({ ...recallAll(), ...all }));
  } catch {
    // Storage full or blocked; the ban notice just shows less.
  }
};

// When the app no longer has a server loaded, use what it remembered, then whatever the
// server still shares with former members (state on some servers, the public summary).
export const fetchBannedRoom = async (
  mx: MatrixClient,
  roomIdOrAlias: string
): Promise<{ roomId: string; name?: string; mods: Mod[] }> => {
  const roomId = roomIdOrAlias.startsWith('#')
    ? (await mx.getRoomIdForAlias(roomIdOrAlias)).room_id
    : roomIdOrAlias;
  const remembered = recallAll()[roomId];
  let name = remembered?.name;
  let mods = remembered?.mods ?? [];
  try {
    const events = (await mx.roomState(roomId)) as unknown as {
      type: string;
      state_key?: string;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      content: Record<string, any>;
    }[];
    const find = (type: string, key = '') =>
      events.find((e) => e.type === type && e.state_key === key)?.content;
    name = name || find('m.room.name')?.name || find('m.room.canonical_alias')?.alias;
    const pl = find('m.room.power_levels') ?? {};
    const create = events.find((e) => e.type === 'm.room.create');
    const ids = new Set(create ? getRoomCreators(new MatrixEvent(create as never)) : []);
    Object.entries<number>(pl.users ?? {}).forEach(([id, level]) => {
      if (level >= (pl.ban ?? 50)) ids.add(id);
    });
    ids.delete(mx.getSafeUserId());
    if (mods.length === 0) {
      mods = [...ids]
        .slice(0, 8)
        .map((id) => ({ id, name: find('m.room.member', id)?.displayname || id }));
    }
  } catch {
    // Most servers hide state from banned members.
  }
  if (!name)
    name = await mx.getRoomSummary(roomId).then(
      (r: { name?: string }) => r.name,
      () => undefined
    );
  return { roomId, name, mods };
};

export const appealsUsed = (mx: MatrixClient, spaceId: string): number =>
  mx.getAccountData(APPEALS_USED_KEY as never)?.getContent()?.[spaceId] ?? 0;

// An appeal for this server that's still waiting on the mods.
export const openAppealFor = (mx: MatrixClient, spaceId: string): Room | undefined =>
  mx
    .getRooms()
    .find(
      (r: Room) =>
        r.getMyMembership() === Membership.Join &&
        getAppeal(r)?.space === spaceId &&
        getAppeal(r)?.status === 'open'
    );

export const submitAppeal = async (
  mx: MatrixClient,
  space: { roomId: string; name: string },
  mods: Mod[],
  text: string
) => {
  const used = appealsUsed(mx, space.roomId);
  if (used >= MAX_APPEALS) throw new Error("You've used all your appeals for this server.");
  const content: AppealContent = {
    space: space.roomId,
    space_name: space.name,
    attempt: used + 1,
    status: 'open',
  };
  const { room_id: roomId } = await mx.createRoom({
    name: `Appeal · ${space.name}`,
    preset: 'private_chat' as never,
    invite: mods.map((m) => m.id),
    initial_state: [{ type: APPEAL_STATE, state_key: '', content }],
    power_level_content_override: {
      users: Object.fromEntries([[mx.getSafeUserId(), 100], ...mods.map((m) => [m.id, 100])]),
    },
  });
  await mx.sendMessage(roomId, { msgtype: 'm.text', body: text } as never);
  const all = mx.getAccountData(APPEALS_USED_KEY as never)?.getContent() ?? {};
  await mx.setAccountData(APPEALS_USED_KEY as never, { ...all, [space.roomId]: used + 1 } as never);
  return roomId;
};

// The appellant is whoever created the room, never what its state claims.
export const getAppellant = (room: Room): string | undefined =>
  room.currentState.getStateEvents('m.room.create', '')?.getSender();

export const canDecide = (mx: MatrixClient, appeal: AppealContent): boolean => {
  const space = mx.getRoom(appeal.space);
  if (!space || space.getMyMembership() !== Membership.Join) return false;
  const myId = mx.getSafeUserId();
  if (getRoomCreatorsForRoomId(mx, space.roomId).has(myId)) return true;
  const pl = space.currentState.getStateEvents('m.room.power_levels', '')?.getContent() ?? {};
  const mine = pl.users?.[myId] ?? pl.users_default ?? 0;
  return mine >= (pl.ban ?? 50);
};

// Earlier appeals by this user for this server, in case the attempt number was tampered with.
const pastAppeals = (mx: MatrixClient, user: string, spaceId: string, except: string) =>
  mx
    .getRooms()
    .filter(
      (r: Room) =>
        r.roomId !== except && getAppellant(r) === user && getAppeal(r)?.space === spaceId
    ).length;

export const APPEAL_NOTICES: Record<Exclude<AppealStatus, 'open'>, string> = {
  accepted: 'Appeal accepted, you have been unbanned.',
  denied: 'Appeal denied.',
  closed: 'Appeal denied. Appeals for this server are now closed.',
};

// The appellant's app sees the new status, shows the outcome and leaves the room.
export const decideAppeal = async (mx: MatrixClient, room: Room, accept: boolean) => {
  const appeal = getAppeal(room);
  const user = getAppellant(room);
  if (!appeal || !user) throw new Error('This is not an appeal.');
  const attempt = Math.max(appeal.attempt, pastAppeals(mx, user, appeal.space, room.roomId) + 1);
  let status: AppealStatus = 'denied';
  if (accept) status = 'accepted';
  else if (attempt >= MAX_APPEALS) status = 'closed';

  if (accept) await mx.unban(appeal.space, user);
  await mx.sendStateEvent(
    room.roomId,
    APPEAL_STATE as never,
    { ...appeal, attempt, status } as never,
    ''
  );
  await mx.sendMessage(room.roomId, { msgtype: 'm.notice', body: APPEAL_NOTICES[status] } as never);
};

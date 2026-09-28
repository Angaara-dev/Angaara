import { MatrixClient, MatrixEvent, Room, RoomMember } from 'matrix-js-sdk';
import { Membership, StateEvent } from '../../../types/matrix/room';
import { creatorsSupported } from '../../utils/matrix';
import { getRoomCreators, getRoomCreatorsForRoomId } from '../../hooks/useRoomCreators';

// State in an appeal room, which a banned user opens with the people who can unban them.
export const APPEAL_STATE = 'io.angaara.appeal';
// Account data counting the appeals used per server.
const APPEALS_USED_KEY = 'io.angaara.appeals';
// How many appeals a ban gets, unless the server sets its own (between 1 and 10).
export const DEFAULT_APPEALS = 2;
export const MAX_APPEALS_LIMIT = 10;
export const clampAppeals = (n: unknown): number =>
  typeof n === 'number' && Number.isFinite(n)
    ? Math.min(MAX_APPEALS_LIMIT, Math.max(1, Math.round(n)))
    : DEFAULT_APPEALS;

export type AppealStatus = 'open' | 'denied' | 'accepted' | 'closed';
export type AppealContent = {
  space: string;
  space_name: string;
  attempt: number;
  status: AppealStatus;
  // Closed tickets stay around for the mods, filed under Archived.
  archived?: boolean;
  // The server's appeal limit when this one was sent.
  max?: number;
  // Set once every mod has been invited to read the archived ticket.
  shared?: boolean;
  // A ban from one room in the server, which the server's mods handle.
  room?: string;
  room_name?: string;
};

// What a ticket is about, for labels: "Room: #general" or "Server: Angaara".
export const appealLabel = (mx: MatrixClient, appeal: AppealContent): string =>
  appeal.room
    ? `Room: ${mx.getRoom(appeal.room)?.name ?? appeal.room_name ?? 'a room'}`
    : `Server: ${appeal.space_name}`;

// What a ticket is about: the room it names, or the whole server.
export const appealTarget = (appeal: AppealContent): string => appeal.room ?? appeal.space;

const isChildOf = (space: Room | null | undefined, roomId: string): boolean =>
  !!space?.currentState.getStateEvents('m.space.child', roomId)?.getContent()?.via;

// The joined server a room belongs to, whose mods handle appeals for it.
export const parentServer = (mx: MatrixClient, roomId: string): Room | undefined =>
  mx
    .getRooms()
    .find(
      (r: Room) =>
        r.isSpaceRoom() && r.getMyMembership() === Membership.Join && isChildOf(r, roomId)
    );

export type Mod = { id: string; name: string };

// Invites only carry a few basic details, so an invited ticket is recognised by its name.
export const appealRoomName = (spaceName: string) => `Appeal · ${spaceName}`;

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
  // Whoever banned you can unban you, and their ban is often all the app still has.
  const mine = room.getMember(myId)?.events.member;
  if (mine?.getContent().membership === Membership.Ban && mine.getSender()) {
    ids.add(mine.getSender() as string);
  }
  ids.delete(myId);
  return [...ids].slice(0, 8).map((id) => ({ id, name: room.getMember(id)?.name ?? id }));
};

// Servers opt in to appeals from their settings; off unless turned on.
export const appealsEnabled = (room: Room | null): boolean =>
  room?.currentState.getStateEvents(StateEvent.AngaaraBanAppeals, '')?.getContent()?.enabled ===
  true;

export const appealLimit = (room: Room | null): number =>
  clampAppeals(
    room?.currentState.getStateEvents(StateEvent.AngaaraBanAppeals, '')?.getContent()?.max
  );

export const appealMax = (appeal: AppealContent): number => clampAppeals(appeal.max);

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
type Remembered = Record<
  string,
  { name: string; mods: Mod[]; enabled?: boolean; max?: number; space?: boolean }
>;
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
    if (mods.length > 0)
      all[room.roomId] = {
        name: room.name,
        mods,
        enabled: appealsEnabled(room),
        max: appealLimit(room),
        space: room.isSpaceRoom(),
      };
  });
  try {
    // Keep what we knew about rooms we've since left or been banned from.
    localStorage.setItem(REMEMBERED_KEY, JSON.stringify({ ...recallAll(), ...all }));
  } catch {
    // Storage full or blocked; the ban notice just shows less.
  }
};

type RawEvent = {
  type: string;
  sender?: string;
  state_key?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  content: Record<string, any>;
};

// Servers hide a room's state from banned members, but a sync that includes left rooms
// still hands back the state as of the ban.
const leftRoomState = async (mx: MatrixClient, roomId: string): Promise<RawEvent[]> => {
  const filter = {
    room: {
      rooms: [roomId],
      include_leave: true,
      timeline: { limit: 1 },
      state: { lazy_load_members: false },
      ephemeral: { not_types: ['*'] },
      account_data: { not_types: ['*'] },
    },
    presence: { not_types: ['*'] },
    account_data: { not_types: ['*'] },
  };
  const res = await mx.http.authedRequest<{
    rooms?: { leave?: Record<string, { state?: { events?: RawEvent[] } }> };
  }>('GET' as never, '/sync', { full_state: 'true', filter: JSON.stringify(filter) });
  const left = res.rooms?.leave?.[roomId] as
    | { state?: { events?: RawEvent[] }; timeline?: { events?: RawEvent[] } }
    | undefined;
  return [...(left?.state?.events ?? []), ...(left?.timeline?.events ?? [])];
};

// When the app no longer has a server loaded, use what it remembered, then the state as of
// the ban, then the public summary for at least a name.
export const fetchBannedRoom = async (
  mx: MatrixClient,
  roomIdOrAlias: string
): Promise<{
  roomId: string;
  name?: string;
  mods: Mod[];
  enabled: boolean;
  max: number;
  space?: boolean;
}> => {
  const roomId = roomIdOrAlias.startsWith('#')
    ? (await mx.getRoomIdForAlias(roomIdOrAlias)).room_id
    : roomIdOrAlias;
  const remembered = recallAll()[roomId];
  let name = remembered?.name;
  const local = mx.getRoom(roomId);
  let mods = remembered?.mods ?? getMods(mx, local);
  let enabled = remembered?.enabled ?? (local ? appealsEnabled(local) : undefined);
  let max = remembered?.max ?? (local ? appealLimit(local) : undefined);
  let space = remembered?.space ?? local?.isSpaceRoom();
  if (!name || mods.length === 0 || enabled === undefined || space === undefined) {
    const events = await leftRoomState(mx, roomId).catch(() => [] as RawEvent[]);
    const find = (type: string, key = '') =>
      events.filter((e) => e.type === type && e.state_key === key).pop();
    name =
      name || find('m.room.name')?.content.name || find('m.room.canonical_alias')?.content.alias;
    enabled = enabled ?? find(StateEvent.AngaaraBanAppeals)?.content.enabled === true;
    max = max ?? clampAppeals(find(StateEvent.AngaaraBanAppeals)?.content.max);
    const createType = find('m.room.create')?.content.type;
    if (space === undefined && events.length > 0) space = createType === 'm.space';
    if (mods.length === 0) {
      const myId = mx.getSafeUserId();
      const pl = find('m.room.power_levels')?.content ?? {};
      const create = find('m.room.create');
      const ids = new Set(create ? getRoomCreators(new MatrixEvent(create as never)) : []);
      Object.entries<number>(pl.users ?? {}).forEach(([id, level]) => {
        if (level >= (pl.ban ?? 50)) ids.add(id);
      });
      const ban = find('m.room.member', myId);
      if (ban?.content.membership === Membership.Ban && ban.sender) ids.add(ban.sender);
      ids.delete(myId);
      mods = [...ids]
        .slice(0, 8)
        .map((id) => ({ id, name: find('m.room.member', id)?.content.displayname || id }));
    }
  }
  if (!name || space === undefined) {
    const summary = await mx.getRoomSummary(roomId).catch(() => undefined);
    name = name || summary?.name;
    if (space === undefined && summary) space = summary.room_type === 'm.space';
  }
  return { roomId, name, mods, enabled: enabled === true, max: max ?? DEFAULT_APPEALS, space };
};

export const appealsUsed = (mx: MatrixClient, spaceId: string): number =>
  mx.getAccountData(APPEALS_USED_KEY as never)?.getContent()?.[spaceId] ?? 0;

// An appeal for this server or room that's still waiting on the mods.
export const openAppealFor = (mx: MatrixClient, targetId: string): Room | undefined =>
  mx
    .getRooms()
    .find(
      (r: Room) =>
        r.getMyMembership() === Membership.Join &&
        !!getAppeal(r) &&
        appealTarget(getAppeal(r) as AppealContent) === targetId &&
        getAppeal(r)?.status === 'open' &&
        !getAppeal(r)?.archived
    );

export const submitAppeal = async (
  mx: MatrixClient,
  space: { roomId: string; name: string },
  mods: Mod[],
  text: string,
  max: number,
  room?: { roomId: string; name: string }
) => {
  // Room bans are counted apart from the server's own.
  const target = room?.roomId ?? space.roomId;
  const used = appealsUsed(mx, target);
  if (used >= max)
    throw new Error(`You've used all your appeals for this ${room ? 'room' : 'server'}.`);
  const content: AppealContent = {
    space: space.roomId,
    space_name: space.name,
    attempt: used + 1,
    status: 'open',
    max,
    ...(room ? { room: room.roomId, room_name: room.name } : {}),
  };
  // Newer room versions give the creator top power already and reject them in the list.
  const caps = await mx.getCapabilities().catch(() => undefined);
  const version: string = caps?.['m.room_versions']?.default ?? '10';
  const users = Object.fromEntries([
    ...(creatorsSupported(version) ? [] : [[mx.getSafeUserId(), 100]]),
    ...mods.map((m) => [m.id, 100]),
  ]);
  const { room_id: roomId } = await mx.createRoom({
    name: appealRoomName(space.name),
    preset: 'private_chat' as never,
    invite: mods.map((m) => m.id),
    initial_state: [{ type: APPEAL_STATE, state_key: '', content }],
    power_level_content_override: { users },
  });
  await mx.sendMessage(roomId, { msgtype: 'm.text', body: text } as never);
  const all = mx.getAccountData(APPEALS_USED_KEY as never)?.getContent() ?? {};
  await mx.setAccountData(APPEALS_USED_KEY as never, { ...all, [target]: used + 1 } as never);
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

// While open, a ticket is only between the appellant and the one mod it went to. Once
// closed, everyone who can ban and unban in the server is invited to read it.
export const shareArchive = async (
  mx: MatrixClient,
  room: Room,
  appeal: AppealContent | undefined = getAppeal(room)
) => {
  const space = appeal && mx.getRoom(appeal.space);
  if (!appeal?.archived || appeal.shared || !space || !canDecide(mx, appeal)) return;
  const inRoom = (id: string) => {
    const m = room.getMember(id)?.membership;
    return m === Membership.Join || m === Membership.Invite;
  };
  const mods = getMods(mx, space).filter((m) => !inRoom(m.id));
  await Promise.all(mods.map((m) => mx.invite(room.roomId, m.id).catch(() => undefined)));
  await mx.sendStateEvent(
    room.roomId,
    APPEAL_STATE as never,
    { ...appeal, shared: true } as never,
    ''
  );
};

// Earlier appeals by this user for the same ban, in case the attempt number was tampered with.
const pastAppeals = (mx: MatrixClient, user: string, appeal: AppealContent, except: string) =>
  mx.getRooms().filter((r: Room) => {
    const other = getAppeal(r);
    return (
      r.roomId !== except &&
      getAppellant(r) === user &&
      other?.space === appeal.space &&
      appealTarget(other) === appealTarget(appeal)
    );
  }).length;

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
  const attempt = Math.max(appeal.attempt, pastAppeals(mx, user, appeal, room.roomId) + 1);
  // The server's current limit wins, so raising it gives pending appellants more tries.
  const space = mx.getRoom(appeal.space);
  const max = space ? appealLimit(space) : appealMax(appeal);
  let status: AppealStatus = 'denied';
  if (accept) status = 'accepted';
  else if (attempt >= max) status = 'closed';

  // The appellant wrote the ticket, so only unban a room that really is in this server.
  if (accept && appeal.room && !isChildOf(space, appeal.room)) {
    throw new Error("That room isn't part of this server anymore, so it can't be unbanned here.");
  }
  if (accept) await mx.unban(appeal.room ?? appeal.space, user);
  const decided: AppealContent = { ...appeal, attempt, status, max, archived: true };
  await mx.sendStateEvent(room.roomId, APPEAL_STATE as never, decided as never, '');
  await mx.sendMessage(room.roomId, { msgtype: 'm.notice', body: APPEAL_NOTICES[status] } as never);
  await shareArchive(mx, room, decided);
};

// Either side can close a ticket; the mods keep it under Archived, the appellant leaves it.
export const closeAppeal = async (mx: MatrixClient, room: Room) => {
  const appeal = getAppeal(room);
  if (!appeal) throw new Error('This is not an appeal.');
  const mine = getAppellant(room) === mx.getSafeUserId();
  const closed: AppealContent = { ...appeal, archived: true };
  await mx.sendStateEvent(room.roomId, APPEAL_STATE as never, closed as never, '');
  await mx.sendMessage(room.roomId, {
    msgtype: 'm.notice',
    body: mine ? 'Appeal withdrawn.' : 'Appeal closed.',
  } as never);
  if (mine) await mx.leave(room.roomId);
  else await shareArchive(mx, room, closed);
};

// Appeal tickets for a server that you're in or invited to, newest first.
export const spaceAppeals = (mx: MatrixClient, space: Room): Room[] =>
  mx
    .getRooms()
    .filter((r: Room) => {
      const membership = r.getMyMembership();
      if (membership === Membership.Invite) return r.name === appealRoomName(space.name);
      return (
        membership === Membership.Join &&
        getAppeal(r)?.space === space.roomId &&
        getAppellant(r) !== mx.getSafeUserId()
      );
    })
    .sort(
      (a: Room, b: Room) =>
        (b.currentState.getStateEvents('m.room.create', '')?.getTs() ?? 0) -
        (a.currentState.getStateEvents('m.room.create', '')?.getTs() ?? 0)
    );

// Whether you can ban (and so unban) in this server.
export const canUnbanIn = (mx: MatrixClient, space: Room): boolean =>
  space.getMyMembership() === Membership.Join &&
  canDecide(mx, { space: space.roomId, space_name: '', attempt: 0, status: 'open' });

// Banned members can't read the server's settings anymore, so a mod's app messages their
// apps directly once whenever the appeal settings change.
export const APPEAL_SETTINGS_PING = 'io.angaara.ban_appeals.ping';
const PINGED_KEY = 'angaara_appeal_settings';
type AppealSettings = { enabled: boolean; max: number };

export const pingBanned = async (mx: MatrixClient, space: Room, settings: AppealSettings) => {
  const banned: string[] = space
    .getMembers()
    .filter((m: RoomMember) => m.membership === Membership.Ban)
    .map((m: RoomMember) => m.userId);
  if (banned.length === 0) return;
  const content = { space: space.roomId, ...settings };
  const map = new Map(banned.map((id) => [id, new Map([['*', content]])]));
  await mx.sendToDevice(APPEAL_SETTINGS_PING, map as never);
};

const pingedAll = (): Record<string, AppealSettings> => {
  try {
    return JSON.parse(localStorage.getItem(PINGED_KEY) ?? '{}');
  } catch {
    return {};
  }
};
export const pingedSettings = (spaceId: string): AppealSettings | undefined => pingedAll()[spaceId];

// Keeps a ping only from someone who could actually unban you there.
export const receivePing = (mx: MatrixClient, event: MatrixEvent): string | undefined => {
  if (event.getType() !== APPEAL_SETTINGS_PING) return undefined;
  const { space, enabled, max } = event.getContent();
  const sender = event.getSender();
  if (typeof space !== 'string' || !sender) return undefined;
  const known = recallAll()[space]?.mods ?? getMods(mx, mx.getRoom(space));
  if (known.length > 0 && !known.some((m) => m.id === sender)) return undefined;
  try {
    const all = { ...pingedAll(), [space]: { enabled: enabled === true, max: clampAppeals(max) } };
    localStorage.setItem(PINGED_KEY, JSON.stringify(all));
  } catch {
    return undefined;
  }
  return space;
};

// The Angaara bot joins servers with appeals on, so the Worker can read their real settings
// for banned members; see worker/appeals.js.
const appealsApi = (path: string) => `${window.location.origin}/api/appeals/${path}`;

let botIdTask: Promise<string | undefined> | undefined;
export const getAppealsBotId = (): Promise<string | undefined> => {
  botIdTask ??= fetch(appealsApi('bot'))
    .then((res) => res.json())
    .then((bot) => (bot?.bot && typeof bot.userId === 'string' ? bot.userId : undefined))
    .catch(() => undefined)
    .then((id) => {
      if (!id) botIdTask = undefined;
      return id;
    });
  return botIdTask;
};

// Undefined when the bot isn't in that server or the Worker can't be reached.
export const fetchLiveSettings = async (roomId: string): Promise<AppealSettings | undefined> => {
  const res = await fetch(appealsApi(`settings/${encodeURIComponent(roomId)}`)).catch(
    () => undefined
  );
  const data = await res?.json().catch(() => undefined);
  if (!data?.bot) return undefined;
  return { enabled: data.enabled === true, max: clampAppeals(data.max) };
};

export const botInSpace = (space: Room, botId: string | undefined): boolean =>
  !!botId && space.getMember(botId)?.membership === Membership.Join;

// Invites the bot and has it join; the Worker checks the invite came from you.
export const addAppealsBot = async (mx: MatrixClient, space: Room): Promise<void> => {
  const botId = await getAppealsBotId();
  if (!botId) throw new Error("The Angaara bot isn't available right now.");
  if (botInSpace(space, botId)) return;
  if (space.getMember(botId)?.membership !== Membership.Invite) {
    await mx.invite(space.roomId, botId);
  }
  const res = await fetch(appealsApi('join'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ openid: await mx.getOpenIdToken(), room: space.roomId }),
  });
  if (!res.ok) throw new Error("The Angaara bot couldn't join this server.");
};

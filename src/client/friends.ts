import { EventType, MatrixClient, Preset, Room, Visibility } from 'matrix-js-sdk';
import { getVaultItem, updateVaultItem } from './vault';
import { setDirectRoom } from './directs';

// Friend requests are encrypted DM invites marked with this key, so Angaara can tell them apart.
// The friends list itself lives in the encrypted vault; other apps just see a DM invite.
export const FRIEND_REQUEST_KEY = 'io.angaara.friend_request';

export type Friend = { roomId?: string; since: number };
export type OutgoingRequest = { roomId: string; sent: number };
export type FriendsData = {
  friends: Record<string, Friend>;
  outgoing: Record<string, OutgoingRequest>;
};
export type IncomingRequest = { roomId: string; userId: string; ts: number };

const USER_ID_RE = /^@[a-z0-9._=\-/+]+:[a-z0-9.-]+(:\d{1,5})?$/i;
export const isValidUserId = (userId: string) => USER_ID_RE.test(userId) && userId.length <= 255;

const empty = (): FriendsData => ({ friends: {}, outgoing: {} });
export const normalizeFriends = (raw: unknown): FriendsData => {
  const data = raw as Partial<FriendsData> | undefined;
  return {
    friends: data?.friends && typeof data.friends === 'object' ? data.friends : {},
    outgoing: data?.outgoing && typeof data.outgoing === 'object' ? data.outgoing : {},
  };
};
export const getFriendsData = (): FriendsData => normalizeFriends(getVaultItem('friends'));
const updateFriends = (change: (data: FriendsData) => FriendsData) =>
  updateVaultItem<FriendsData>('friends', (prev) =>
    change({
      ...empty(),
      ...(prev ?? {}),
      friends: prev?.friends ?? {},
      outgoing: prev?.outgoing ?? {},
    })
  );
const omit = <T>(record: Record<string, T>, ...keys: string[]): Record<string, T> =>
  Object.fromEntries(Object.entries(record).filter(([key]) => !keys.includes(key)));

const myMemberEvent = (mx: MatrixClient, room: Room) =>
  room.getMember(mx.getSafeUserId())?.events.member;

// Invites to you that were sent as friend requests (by anyone you haven't blocked).
export function getIncomingRequests(mx: MatrixClient): IncomingRequest[] {
  const ignored = new Set(mx.getIgnoredUsers());
  return mx
    .getRooms()
    .filter((room) => room.getMyMembership() === 'invite')
    .flatMap((room) => {
      const event = myMemberEvent(mx, room);
      const sender = event?.getSender();
      if (!event || !sender || event.getContent()[FRIEND_REQUEST_KEY] !== true) return [];
      if (ignored.has(sender)) return [];
      return [{ roomId: room.roomId, userId: sender, ts: event.getTs() }];
    });
}

export async function acceptFriendRequest(mx: MatrixClient, request: IncomingRequest) {
  await mx.joinRoom(request.roomId);
  await updateFriends((d) => ({
    friends: { ...d.friends, [request.userId]: { roomId: request.roomId, since: Date.now() } },
    outgoing: omit(d.outgoing, request.userId),
  }));
  await setDirectRoom(mx, request.roomId, request.userId);
}

export async function sendFriendRequest(mx: MatrixClient, userId: string) {
  const myId = mx.getSafeUserId();
  if (!isValidUserId(userId)) throw new Error('Enter a full user ID, like @name:server.');
  if (userId === myId) throw new Error("You can't add yourself.");
  const data = getFriendsData();
  if (data.friends[userId]) throw new Error("You're already friends.");
  if (data.outgoing[userId]) throw new Error('Friend request already sent.');
  const incoming = getIncomingRequests(mx).find((r) => r.userId === userId);
  if (incoming) {
    await acceptFriendRequest(mx, incoming);
    return;
  }

  // Checks the user exists before creating anything.
  await mx.getProfileInfo(userId);
  const { room_id: roomId } = await mx.createRoom({
    is_direct: true,
    visibility: Visibility.Private,
    preset: Preset.TrustedPrivateChat,
    initial_state: [
      {
        type: EventType.RoomEncryption,
        state_key: '',
        content: { algorithm: 'm.megolm.v1.aes-sha2' },
      },
    ],
  });
  // Sent as a membership state event so the invite can carry the friend-request marker.
  await mx.sendStateEvent(
    roomId,
    EventType.RoomMember,
    { membership: 'invite', is_direct: true, [FRIEND_REQUEST_KEY]: true } as any,
    userId
  );
  await updateFriends((d) => ({
    ...d,
    outgoing: { ...d.outgoing, [userId]: { roomId, sent: Date.now() } },
  }));
  await setDirectRoom(mx, roomId, userId);
}

export async function declineFriendRequest(mx: MatrixClient, request: IncomingRequest) {
  await mx.leave(request.roomId);
}

export async function cancelFriendRequest(mx: MatrixClient, userId: string) {
  const request = getFriendsData().outgoing[userId];
  if (request) {
    // Withdraws the invite, then leaves the empty room.
    await mx.kick(request.roomId, userId).catch(() => undefined);
    await mx.leave(request.roomId).catch(() => undefined);
    await setDirectRoom(mx, request.roomId);
  }
  await updateFriends((d) => ({ ...d, outgoing: omit(d.outgoing, userId) }));
}

// Removes them from your list; the DM stays so your messages aren't lost.
export async function removeFriend(userId: string) {
  await updateFriends((d) => ({ ...d, friends: omit(d.friends, userId) }));
}

// Uses Matrix's ignore list, so blocking works in every app and stops their DMs and invites.
export async function blockUser(mx: MatrixClient, userId: string) {
  const ignored = mx.getIgnoredUsers();
  if (!ignored.includes(userId)) await mx.setIgnoredUsers([...ignored, userId]);
  const invites = getIncomingRequests(mx).filter((r) => r.userId === userId);
  await Promise.all(invites.map((r) => mx.leave(r.roomId).catch(() => undefined)));
  const data = getFriendsData();
  if (data.outgoing[userId]) await cancelFriendRequest(mx, userId);
  if (data.friends[userId]) await removeFriend(userId);
}

export async function unblockUser(mx: MatrixClient, userId: string) {
  await mx.setIgnoredUsers(mx.getIgnoredUsers().filter((id) => id !== userId));
}

// Moves sent requests to friends once accepted, drops declined ones, and picks up
// requests you accepted somewhere else (like the Inbox or another device).
export async function reconcileFriends(mx: MatrixClient) {
  const myId = mx.getSafeUserId();
  const data = getFriendsData();
  const accepted: Record<string, string> = {};
  const gone: string[] = [];
  Object.entries(data.outgoing).forEach(([userId, request]) => {
    const room = mx.getRoom(request.roomId);
    // Not synced yet (just sent): leave it alone.
    if (!room) return;
    const membership = room.getMember(userId)?.membership;
    if (membership === 'join') accepted[userId] = request.roomId;
    else if (membership === 'leave' || room.getMyMembership() === 'leave') gone.push(userId);
  });
  mx.getRooms().forEach((room) => {
    if (room.getMyMembership() !== 'join' || room.getJoinedMemberCount() !== 2) return;
    const joined = myMemberEvent(mx, room);
    if (joined?.getPrevContent()?.[FRIEND_REQUEST_KEY] !== true) return;
    const other = room.getJoinedMembers().find((m) => m.userId !== myId)?.userId;
    if (other && !data.friends[other]) accepted[other] = room.roomId;
  });
  if (Object.keys(accepted).length === 0 && gone.length === 0) return;
  const since = Date.now();
  await updateFriends((d) => ({
    friends: {
      ...d.friends,
      ...Object.fromEntries(
        Object.entries(accepted).map(([userId, roomId]) => [userId, { roomId, since }])
      ),
    },
    outgoing: omit(d.outgoing, ...Object.keys(accepted), ...gone),
  }));
}

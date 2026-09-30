import { MatrixClient, Room } from 'matrix-js-sdk';
import { getVaultItem, updateVaultItem, vaultReady } from './vault';
import { FRIEND_REQUEST_KEY, getFriendsData } from './friends';

// Matrix can't filter invites on the server, so Angaara quietly declines blocked ones itself.
export type CommunityPrivacy = { allowDms: boolean; allowFriendRequests: boolean };
type PrivacyData = { communities: Record<string, Partial<CommunityPrivacy>> };

const DEFAULTS: CommunityPrivacy = { allowDms: true, allowFriendRequests: true };

const communities = (raw: unknown): PrivacyData['communities'] => {
  const data = raw as Partial<PrivacyData> | undefined;
  return data?.communities && typeof data.communities === 'object' ? data.communities : {};
};

export const readCommunityPrivacy = (raw: unknown, spaceId: string): CommunityPrivacy => ({
  ...DEFAULTS,
  ...communities(raw)[spaceId],
});

export async function setCommunityPrivacy(spaceId: string, patch: Partial<CommunityPrivacy>) {
  await updateVaultItem<PrivacyData>('privacy', (prev) => {
    const all = communities(prev);
    return { communities: { ...all, [spaceId]: { ...all[spaceId], ...patch } } };
  });
}

// Whether they've joined that community, checked with one small request (member lists are lazy).
async function isCommunityMember(mx: MatrixClient, spaceId: string, userId: string) {
  const loaded = mx.getRoom(spaceId)?.getMember(userId)?.membership;
  if (loaded) return loaded === 'join';
  try {
    const content = await mx.getStateEvent(spaceId, 'm.room.member', userId);
    return content?.membership === 'join';
  } catch {
    return false;
  }
}

export async function isBlockedInvite(mx: MatrixClient, room: Room): Promise<boolean> {
  if (!vaultReady() || room.getMyMembership() !== 'invite') return false;
  const event = room.getMember(mx.getSafeUserId())?.events.member;
  const sender = event?.getSender();
  if (!event || !sender || getFriendsData().friends[sender]) return false;
  const content = event.getContent();
  const friendRequest = content[FRIEND_REQUEST_KEY] === true;
  if (!friendRequest && content.is_direct !== true) return false;

  const settings = communities(getVaultItem('privacy'));
  const blocking = Object.keys(settings).filter((spaceId) => {
    const privacy = { ...DEFAULTS, ...settings[spaceId] };
    return friendRequest ? !privacy.allowFriendRequests : !privacy.allowDms;
  });
  const checks = await Promise.all(
    blocking.map((spaceId) => isCommunityMember(mx, spaceId, sender))
  );
  return checks.some(Boolean);
}

const handled = new Set<string>();
export async function declineBlockedInvites(mx: MatrixClient) {
  const invites = mx.getRooms().filter((r) => r.getMyMembership() === 'invite');
  await Promise.all(
    invites.map(async (room) => {
      if (handled.has(room.roomId) || !(await isBlockedInvite(mx, room))) return;
      handled.add(room.roomId);
      await mx.leave(room.roomId).catch(() => handled.delete(room.roomId));
    })
  );
}

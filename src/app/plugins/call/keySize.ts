import { MatrixClient, MatrixEvent, Room, RoomMember } from 'matrix-js-sdk';
import { CallMembership } from 'matrix-js-sdk/lib/matrixrtc/CallMembership';

// Voice frames use AES-256 only when every device in the call runs Angaara; otherwise AES-128,
// which every Matrix app understands. Server channels always use AES-128 so anyone can join.
export type KeySize = 128 | 256;

// Marks a device as able to use AES-256, one per device and room.
export const CALL_DEVICE_EVENT = 'io.angaara.call.device';
// The key size the current call in a room uses, and who set it.
export const CALL_KEY_EVENT = 'io.angaara.call.key';

export type CallKeyContent = { size: KeySize; by: string };

// Servers refuse state keys starting with @ unless they're exactly the sender, hence the prefix.
const deviceKey = (userId: string, deviceId: string) => `d|${userId}|${deviceId}`;

const maySend = (mx: MatrixClient, room: Room, type: string): boolean =>
  room.currentState.maySendStateEvent(type, mx.getSafeUserId());

export const isAngaaraDevice = (room: Room, userId: string, deviceId: string): boolean =>
  room.currentState.getStateEvents(CALL_DEVICE_EVENT, deviceKey(userId, deviceId))?.getContent()
    ?.size === 256;

export const getCallKey = (room: Room): CallKeyContent | undefined => {
  const content = room.currentState.getStateEvents(CALL_KEY_EVENT, '')?.getContent();
  if ((content?.size === 256 || content?.size === 128) && typeof content.by === 'string') {
    return { size: content.size, by: content.by };
  }
  return undefined;
};

// Only encrypted DMs where everyone can set room state can use AES-256.
export const canUseStrongKeys = (mx: MatrixClient, room: Room, dm: boolean): boolean =>
  dm &&
  room.hasEncryptionStateEvent() &&
  maySend(mx, room, CALL_DEVICE_EVENT) &&
  maySend(mx, room, CALL_KEY_EVENT);

export const markThisDevice = async (mx: MatrixClient, room: Room): Promise<void> => {
  const deviceId = mx.getDeviceId();
  if (!deviceId || isAngaaraDevice(room, mx.getSafeUserId(), deviceId)) return;
  if (!maySend(mx, room, CALL_DEVICE_EVENT)) return;
  await mx.sendStateEvent(
    room.roomId,
    CALL_DEVICE_EVENT as never,
    { size: 256 } as never,
    deviceKey(mx.getSafeUserId(), deviceId)
  );
};

export const setCallKey = (mx: MatrixClient, room: Room, size: KeySize): Promise<unknown> =>
  mx.sendStateEvent(
    room.roomId,
    CALL_KEY_EVENT as never,
    { size, by: mx.getSafeUserId() } as never,
    ''
  );

const everyoneElseUsesAngaara = (mx: MatrixClient, room: Room): boolean => {
  const me = mx.getSafeUserId();
  const others = room.getJoinedMembers().filter((m: RoomMember) => m.userId !== me);
  return (
    others.length > 0 &&
    others.every((m: RoomMember) =>
      room.currentState
        .getStateEvents(CALL_DEVICE_EVENT)
        .some(
          (e: MatrixEvent) =>
            e.getStateKey()?.startsWith(`d|${m.userId}|`) && e.getContent().size === 256
        )
    )
  );
};

export const callNeedsWeakKeys = (room: Room, memberships: CallMembership[]): boolean =>
  memberships.some((m) => !m.sender || !isAngaaraDevice(room, m.sender, m.deviceId));

// Picks the key size before joining. A call already running keeps whatever it uses.
export const chooseKeySize = async (
  mx: MatrixClient,
  room: Room,
  dm: boolean,
  memberships: CallMembership[]
): Promise<KeySize> => {
  if (!canUseStrongKeys(mx, room, dm)) return 128;
  await markThisDevice(mx, room).catch(() => undefined);
  if (memberships.length > 0) {
    const key = getCallKey(room);
    return key?.size === 256 && !callNeedsWeakKeys(room, memberships) ? 256 : 128;
  }
  const size: KeySize = everyoneElseUsesAngaara(mx, room) ? 256 : 128;
  await setCallKey(mx, room, size).catch(() => undefined);
  return size;
};

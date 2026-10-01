import { MatrixClient, Room } from 'matrix-js-sdk';
import type { ReceivedToDeviceMessage } from 'matrix-js-sdk/lib/sync-accumulator';
import type { CallMembership } from 'matrix-js-sdk/lib/matrixrtc/CallMembership';
import { isSound, Sound, SOUND_HELLO_EVENT, SOUND_PLAY_EVENT } from './types';

type Device = { userId: string; deviceId: string };
const deviceKey = (d: Device) => `${d.userId}|${d.deviceId}`;

// Devices in each call that answered our hello, so they run Angaara and play sounds themselves.
const angaaraDevices = new Map<string, Set<string>>();

const known = (roomId: string) => {
  let set = angaaraDevices.get(roomId);
  if (!set) {
    set = new Set();
    angaaraDevices.set(roomId, set);
  }
  return set;
};

export const forgetCall = (roomId: string) => angaaraDevices.delete(roomId);

// Everyone else's devices in the call, from the call's own membership list.
export const callDevices = (mx: MatrixClient, room: Room): Device[] =>
  (mx.matrixRTC.getRoomSession(room).memberships as CallMembership[])
    .filter((m) => m.sender && m.deviceId)
    .map((m): Device => ({ userId: m.sender as string, deviceId: m.deviceId }))
    .filter((d) => !(d.userId === mx.getUserId() && d.deviceId === mx.getDeviceId()));

const sendEncrypted = async (
  mx: MatrixClient,
  type: string,
  devices: Device[],
  payload: Record<string, unknown>
) => {
  const crypto = mx.getCrypto();
  if (!crypto || devices.length === 0) return;
  const batch = await crypto.encryptToDeviceMessages(type, devices, payload);
  await mx.queueToDevice(batch);
};

export const sayHello = (mx: MatrixClient, room: Room, devices?: Device[], reply = false) =>
  sendEncrypted(mx, SOUND_HELLO_EVENT, devices ?? callDevices(mx, room), {
    room_id: room.roomId,
    reply,
  });

// Call devices that never answered a hello: other apps, which only hear the mic mix.
export const otherAppDevices = (mx: MatrixClient, room: Room): Device[] => {
  const set = known(room.roomId);
  return callDevices(mx, room).filter((d) => !set.has(deviceKey(d)));
};

export const sendSoundPlay = (mx: MatrixClient, room: Room, sound: Sound, mixed: boolean) => {
  const set = known(room.roomId);
  const { id, name, emoji, url, builtin } = sound;
  return sendEncrypted(
    mx,
    SOUND_PLAY_EVENT,
    callDevices(mx, room).filter((d) => set.has(deviceKey(d))),
    { room_id: room.roomId, sound: { id, name, emoji, url, builtin }, mixed }
  );
};

export type IncomingSound = { sound: Sound; userId: string; mixed: boolean };

// Only encrypted messages from a device that's in the call count; hellos are answered once.
export const receiveSoundMessage = (
  mx: MatrixClient,
  payload: ReceivedToDeviceMessage,
  room: Room | undefined
): IncomingSound | undefined => {
  const { message, encryptionInfo } = payload;
  if (!room || !encryptionInfo?.senderDevice) return undefined;
  if (message.type !== SOUND_HELLO_EVENT && message.type !== SOUND_PLAY_EVENT) return undefined;
  const { content } = message;
  if (content?.room_id !== room.roomId) return undefined;
  const from = { userId: message.sender, deviceId: encryptionInfo.senderDevice };
  if (!callDevices(mx, room).some((d) => deviceKey(d) === deviceKey(from))) return undefined;

  known(room.roomId).add(deviceKey(from));
  if (message.type === SOUND_HELLO_EVENT) {
    if (content.reply !== true) sayHello(mx, room, [from], true).catch(() => undefined);
    return undefined;
  }
  if (!isSound(content.sound)) return undefined;
  return { sound: content.sound, userId: from.userId, mixed: content.mixed === true };
};

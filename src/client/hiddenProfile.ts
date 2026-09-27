import {
  ClientEvent,
  EventType,
  MatrixClient,
  MatrixEvent,
  MatrixEventEvent,
  Room,
  RoomEvent,
  RoomStateEvent,
  SyncState,
} from 'matrix-js-sdk';
import { StateEvent } from '../types/matrix/room';
import { sendEncrypted } from './sendEncrypted';

// The real name and topic live in an encrypted timeline event; a state event points to the
// latest one. The server only ever sees the placeholder name below.
export const HIDDEN_PROFILE_EVENT = 'io.angaara.room.profile';
export const PUBLIC_ROOM_NAME = 'Encrypted room';
const MAX_NAME = 255;
const MAX_TOPIC = 4096;

export type HiddenProfile = { name: string; topic: string };
type Entry = { eventId: string; sender: string; ts: number; profile?: HiddenProfile };

type Manager = {
  entries: Map<string, Entry>;
  listeners: Set<(roomId: string) => void>;
  reshareTimers: Map<string, number>;
};
const managers = new WeakMap<MatrixClient, Manager>();
const getManager = (mx: MatrixClient): Manager => {
  let manager = managers.get(mx);
  if (!manager) {
    manager = { entries: new Map(), listeners: new Set(), reshareTimers: new Map() };
    managers.set(mx, manager);
  }
  return manager;
};
const notify = (mx: MatrixClient, roomId: string) =>
  getManager(mx).listeners.forEach((listener) => listener(roomId));

const readPointer = (room: Room): { eventId: string; sender: string } | undefined => {
  const event = room.currentState.getStateEvents(StateEvent.AngaaraHiddenProfile, '');
  const eventId = event?.getContent()?.event_id;
  const sender = event?.getSender();
  if (typeof eventId !== 'string' || !eventId.startsWith('$') || !sender) return undefined;
  return { eventId, sender };
};

// Only trust the profile if it really was encrypted and came from whoever set the pointer.
const readProfile = (room: Room, event: MatrixEvent, sender: string): HiddenProfile | undefined => {
  if (event.getWireType() !== EventType.RoomMessageEncrypted || event.isDecryptionFailure()) {
    return undefined;
  }
  if (event.getType() !== HIDDEN_PROFILE_EVENT || event.getRoomId() !== room.roomId) {
    return undefined;
  }
  if (event.getSender() !== sender) return undefined;
  if (!room.currentState.maySendStateEvent(StateEvent.AngaaraHiddenProfile, sender)) {
    return undefined;
  }
  const { name, topic } = event.getContent();
  return {
    name: typeof name === 'string' ? name.trim().slice(0, MAX_NAME) : '',
    topic: typeof topic === 'string' ? topic.trim().slice(0, MAX_TOPIC) : '',
  };
};

const applyName = (room: Room, entry?: Entry) => {
  const name = entry?.profile?.name;
  if (name && room.name !== name) {
    // eslint-disable-next-line no-param-reassign
    room.name = name;
    room.emit(RoomEvent.Name, room);
  }
};

export const getHiddenProfile = (mx: MatrixClient, roomId: string) =>
  getManager(mx).entries.get(roomId);

export const onHiddenProfileChange = (mx: MatrixClient, listener: (roomId: string) => void) => {
  const { listeners } = getManager(mx);
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

const fetchEvent = async (mx: MatrixClient, room: Room, eventId: string) => {
  const event =
    room.findEventById(eventId) ?? new MatrixEvent(await mx.fetchRoomEvent(room.roomId, eventId));
  // Also waits when the timeline copy is still mid-decryption.
  await mx.decryptEventIfNeeded(event);
  return event;
};

export const writeHiddenProfile = async (
  mx: MatrixClient,
  room: Room,
  profile: HiddenProfile
): Promise<void> => {
  const clean = {
    name: profile.name.trim().slice(0, MAX_NAME),
    topic: profile.topic.trim().slice(0, MAX_TOPIC),
  };
  const eventId = await sendEncrypted(mx, room, HIDDEN_PROFILE_EVENT, clean);
  await mx.sendStateEvent(room.roomId, StateEvent.AngaaraHiddenProfile as any, {
    event_id: eventId,
  });
  // Everyone joined now got the key; use their join times so clock skew can't cause re-sends.
  const ts = Math.max(
    Date.now(),
    ...room.getJoinedMembers().map((m) => (m.events.member?.getTs() ?? 0) + 1)
  );
  const entry: Entry = { eventId, sender: mx.getSafeUserId(), ts, profile: clean };
  getManager(mx).entries.set(room.roomId, entry);
  applyName(room, entry);
  notify(mx, room.roomId);
};

// People who joined after the latest profile event have no key for it, so an admin's
// Angaara re-sends it (encrypted to everyone currently in the room).
const scheduleReshare = (mx: MatrixClient, room: Room) => {
  const { entries, reshareTimers } = getManager(mx);
  const needsReshare = () => {
    const entry = entries.get(room.roomId);
    const me = mx.getSafeUserId();
    if (!entry?.profile || !entry.ts || !room.hasEncryptionStateEvent()) return false;
    if (!room.currentState.maySendStateEvent(StateEvent.AngaaraHiddenProfile, me)) return false;
    return room
      .getJoinedMembers()
      .some((m) => m.userId !== me && (m.events.member?.getTs() ?? 0) > entry.ts);
  };
  if (reshareTimers.has(room.roomId) || !needsReshare()) return;

  // Random delay so several admins online at once rarely all re-send.
  const delay = 3000 + Math.random() * 7000;
  reshareTimers.set(
    room.roomId,
    window.setTimeout(() => {
      reshareTimers.delete(room.roomId);
      const profile = entries.get(room.roomId)?.profile;
      if (profile && needsReshare()) writeHiddenProfile(mx, room, profile).catch(() => undefined);
    }, delay)
  );
};

const loadRoom = async (mx: MatrixClient, room: Room) => {
  const { entries } = getManager(mx);
  const pointer = readPointer(room);
  const current = entries.get(room.roomId);
  if (!pointer) {
    if (current) {
      entries.delete(room.roomId);
      room.recalculate();
      notify(mx, room.roomId);
    }
    return;
  }
  if (current?.eventId === pointer.eventId) {
    applyName(room, current);
    return;
  }

  const entry: Entry = { eventId: pointer.eventId, sender: pointer.sender, ts: 0 };
  entries.set(room.roomId, entry);
  let event: MatrixEvent;
  try {
    event = await fetchEvent(mx, room, pointer.eventId);
  } catch {
    return;
  }
  const settle = () => {
    if (entries.get(room.roomId) !== entry) return;
    entry.ts = event.getTs();
    entry.profile = readProfile(room, event, pointer.sender);
    applyName(room, entry);
    notify(mx, room.roomId);
    scheduleReshare(mx, room);
  };
  // Keys can arrive later (e.g. from backup); the SDK retries and fires Decrypted then.
  if (event.isDecryptionFailure()) event.once(MatrixEventEvent.Decrypted, settle);
  settle();
};

const stateEvent = (room: Room, type: string) =>
  room.currentState.getStateEvents(type, '') ?? undefined;

// Moves the name and topic into the encrypted profile and blanks them on the server.
export const enableHiddenProfile = async (mx: MatrixClient, room: Room, profile: HiddenProfile) => {
  await writeHiddenProfile(mx, room, profile);

  const nameEvent = stateEvent(room, EventType.RoomName);
  const oldName = nameEvent?.getContent()?.name;
  if (typeof oldName === 'string' && oldName && oldName !== PUBLIC_ROOM_NAME) {
    await mx.sendStateEvent(room.roomId, EventType.RoomName, { name: PUBLIC_ROOM_NAME });
    await mx.redactEvent(room.roomId, nameEvent!.getId()!).catch(() => undefined);
  }
  const topicEvent = stateEvent(room, EventType.RoomTopic);
  const oldTopic = topicEvent?.getContent()?.topic;
  if (typeof oldTopic === 'string' && oldTopic) {
    await mx.sendStateEvent(room.roomId, EventType.RoomTopic, { topic: '' } as any);
    await mx.redactEvent(room.roomId, topicEvent!.getId()!).catch(() => undefined);
  }
};

// Puts the name and topic back in plain state for everyone, including the server.
export const disableHiddenProfile = async (mx: MatrixClient, room: Room) => {
  const profile = getHiddenProfile(mx, room.roomId)?.profile;
  if (!profile) throw new Error("The hidden name hasn't loaded on this device yet.");
  if (profile.name) {
    await mx.sendStateEvent(room.roomId, EventType.RoomName, { name: profile.name });
  }
  if (profile.topic) {
    await mx.sendStateEvent(room.roomId, EventType.RoomTopic, { topic: profile.topic } as any);
  }
  await mx.sendStateEvent(room.roomId, StateEvent.AngaaraHiddenProfile as any, {});
};

export const installHiddenProfiles = (mx: MatrixClient) => {
  const load = (room?: Room | null) => {
    if (room && !room.isSpaceRoom()) loadRoom(mx, room);
  };
  mx.on(ClientEvent.Sync, (state, prevState) => {
    if (state === SyncState.Prepared && prevState !== SyncState.Prepared) {
      mx.getRooms().forEach(load);
    }
  });
  mx.on(ClientEvent.Room, load);
  mx.on(RoomStateEvent.Events, (event) => {
    const room = mx.getRoom(event.getRoomId());
    if (!room) return;
    if (event.getType() === StateEvent.AngaaraHiddenProfile) load(room);
    else if (event.getType() === EventType.RoomMember) scheduleReshare(mx, room);
  });
  // The SDK recomputes names from state; put the hidden one back each time.
  mx.on(RoomEvent.Name, (room) => applyName(room, getManager(mx).entries.get(room.roomId)));
};

// Resolves once the new room and its encryption state have synced, so the profile can be sealed.
export const waitForEncryptedRoom = (mx: MatrixClient, roomId: string, timeoutMs = 30000) =>
  new Promise<Room>((resolve, reject) => {
    let timer = 0;
    let check = (): void => undefined;
    const cleanup = () => {
      window.clearTimeout(timer);
      mx.off(ClientEvent.Room, check);
      mx.off(RoomStateEvent.Events, check);
    };
    check = () => {
      const room = mx.getRoom(roomId);
      if (!room?.hasEncryptionStateEvent()) return;
      cleanup();
      resolve(room);
    };
    timer = window.setTimeout(() => {
      cleanup();
      reject(new Error('The room took too long to sync.'));
    }, timeoutMs);
    mx.on(ClientEvent.Room, check);
    mx.on(RoomStateEvent.Events, check);
    check();
  });

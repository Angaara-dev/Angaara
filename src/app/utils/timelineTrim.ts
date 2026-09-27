import { Method, MatrixClient, MatrixEvent, Room } from 'matrix-js-sdk';

const TRIM_ABOVE = 300;
const KEEP_EVENTS = 50;

const openRooms = new Map<string, number>();

// Returns a cleanup; rooms that are on screen are never trimmed.
export const markRoomOpen = (roomId: string): (() => void) => {
  openRooms.set(roomId, (openRooms.get(roomId) ?? 0) + 1);
  return () => {
    const count = (openRooms.get(roomId) ?? 1) - 1;
    if (count > 0) openRooms.set(roomId, count);
    else openRooms.delete(roomId);
  };
};

const needsTrim = (room: Room): boolean => {
  const timelineSet = room.getUnfilteredTimelineSet();
  return (
    timelineSet.getLiveTimeline().getEvents().length > TRIM_ABOVE ||
    timelineSet.getTimelines().length > 1
  );
};

// /context with limit 0 gives a token for paginating back from just before the event.
const getTokenBefore = async (mx: MatrixClient, roomId: string, eventId: string) => {
  const path = `/rooms/${encodeURIComponent(roomId)}/context/${encodeURIComponent(eventId)}`;
  const res = await mx.http.authedRequest<{ start?: string }>(Method.Get, path, { limit: '0' });
  return res.start;
};

// Drops all but the newest events of a room that's not on screen, freeing old history.
export const trimRoomTimeline = async (mx: MatrixClient, room: Room): Promise<boolean> => {
  if (openRooms.has(room.roomId) || !needsTrim(room)) return false;
  const timelineSet = room.getUnfilteredTimelineSet();
  const events = timelineSet.getLiveTimeline().getEvents();
  const anchorId = events[Math.max(0, events.length - KEEP_EVENTS)]?.getId();
  if (!anchorId || anchorId.startsWith('~')) return false;

  const token = await getTokenBefore(mx, room.roomId, anchorId);
  if (!token || openRooms.has(room.roomId)) return false;

  // Sync may have added events while we waited, so keep everything from the anchor on.
  const current = timelineSet.getLiveTimeline().getEvents();
  const anchorIndex = current.findIndex((e: MatrixEvent) => e.getId() === anchorId);
  if (anchorIndex < 0) return false;
  const keep = current.slice(anchorIndex);
  if (keep.some((e: MatrixEvent) => e.status !== null)) return false;

  timelineSet.resetLiveTimeline(token);
  timelineSet.addEventsToTimeline(
    [...keep].reverse(),
    true,
    false,
    timelineSet.getLiveTimeline(),
    token
  );
  return true;
};

// Trims rooms one at a time so a sweep never bursts requests.
export const trimClosedRooms = async (mx: MatrixClient): Promise<void> => {
  const rooms = mx
    .getRooms()
    .filter((room: Room) => !openRooms.has(room.roomId) && needsTrim(room));
  await rooms.reduce<Promise<unknown>>(
    (prev: Promise<unknown>, room: Room) =>
      prev.then(() => trimRoomTimeline(mx, room)).catch(() => undefined),
    Promise.resolve()
  );
};

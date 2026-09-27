import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import {
  Direction,
  MatrixEvent,
  RelationType,
  Room,
  RoomEvent,
  RoomEventHandlerMap,
} from 'matrix-js-sdk';
import { useMatrixClient } from '../../../hooks/useMatrixClient';
import { isThreadReply } from '../../../utils/room';

const PAGE_LIMIT = 50;

const isReplyTo = (mEvent: MatrixEvent, rootId: string) =>
  isThreadReply(mEvent) && mEvent.threadRootId === rootId;

// Prefer the room's own event instance so edits, reactions and echoes stay linked.
const toRoomEvent = (room: Room, mEvent: MatrixEvent) =>
  room.findEventById(mEvent.getId() ?? '') ?? mEvent;

const mergeReplies = (older: MatrixEvent[], current: MatrixEvent[]): MatrixEvent[] => {
  const ids = new Set(current.map((e) => e.getId()));
  return [...older.filter((e) => !ids.has(e.getId())), ...current];
};

export const useThread = (room: Room, rootId: string) => {
  const mx = useMatrixClient();
  const [, forceUpdate] = useReducer((n: number) => n + 1, 0);
  const [root, setRoot] = useState<MatrixEvent | undefined>(() => room.findEventById(rootId));
  const [replies, setReplies] = useState<MatrixEvent[]>([]);
  const [nextBatch, setNextBatch] = useState<string | null>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error>();
  const activeKey = useRef('');
  activeKey.current = `${room.roomId}/${rootId}`;

  const loadOlder = useCallback(
    async (from?: string) => {
      const key = `${room.roomId}/${rootId}`;
      setLoading(true);
      setError(undefined);
      try {
        const res = await mx.relations(room.roomId, rootId, RelationType.Thread, null, {
          dir: Direction.Backward,
          limit: PAGE_LIMIT,
          from,
        });
        if (activeKey.current !== key) return;
        const original = res.originalEvent;
        if (original) setRoot((r) => r ?? toRoomEvent(room, original));
        const older = res.events
          .filter((e) => isReplyTo(e, rootId))
          .map((e) => toRoomEvent(room, e))
          .reverse();
        setReplies((current) => mergeReplies(older, current));
        setNextBatch(res.nextBatch ?? null);
      } catch (e) {
        if (activeKey.current !== key) return;
        setError(e instanceof Error ? e : new Error(String(e)));
      } finally {
        if (activeKey.current === key) setLoading(false);
      }
    },
    [mx, room, rootId]
  );

  useEffect(() => {
    setRoot(room.findEventById(rootId));
    setReplies([]);
    setNextBatch(undefined);
    loadOlder();
  }, [room, rootId, loadOlder]);

  useEffect(() => {
    const handleTimeline: RoomEventHandlerMap[RoomEvent.Timeline] = (mEvent, r, toStart) => {
      if (r?.roomId !== room.roomId || toStart || !isReplyTo(mEvent, rootId)) return;
      setReplies((current) =>
        current.includes(mEvent) || current.some((e) => e.getId() === mEvent.getId())
          ? current
          : [...current, mEvent]
      );
    };
    room.on(RoomEvent.Timeline, handleTimeline);
    room.on(RoomEvent.LocalEchoUpdated, forceUpdate);
    room.on(RoomEvent.Redaction, forceUpdate);
    return () => {
      room.removeListener(RoomEvent.Timeline, handleTimeline);
      room.removeListener(RoomEvent.LocalEchoUpdated, forceUpdate);
      room.removeListener(RoomEvent.Redaction, forceUpdate);
    };
  }, [room, rootId, forceUpdate]);

  return {
    root,
    replies,
    loading,
    error,
    hasOlder: !!nextBatch,
    loadOlder: useCallback(() => loadOlder(nextBatch ?? undefined), [loadOlder, nextBatch]),
  };
};

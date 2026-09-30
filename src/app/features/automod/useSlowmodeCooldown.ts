import { useCallback, useEffect, useState } from 'react';
import { EventType, Room } from 'matrix-js-sdk';

const lastSent = new Map<string, number>();
const COUNTED: string[] = [
  EventType.RoomMessage,
  EventType.RoomMessageEncrypted,
  EventType.Sticker,
];

// Your latest message in the loaded timeline, so a reload doesn't reset the timer.
const lastFromTimeline = (room: Room): number => {
  const me = room.client.getUserId();
  const events = room.getLiveTimeline().getEvents();
  for (let i = events.length - 1; i >= 0; i -= 1) {
    const ev = events[i];
    if (ev.getSender() === me && COUNTED.includes(ev.getType()) && !ev.isRedacted()) {
      return Math.min(ev.getTs(), Date.now());
    }
  }
  return 0;
};

export const useSlowmodeCooldown = (room: Room, seconds: number, exempt: boolean) => {
  const active = seconds > 0 && !exempt;
  const secondsLeft = useCallback(() => {
    if (!active) return 0;
    const since = Math.max(lastSent.get(room.roomId) ?? 0, lastFromTimeline(room));
    return Math.max(0, Math.ceil((since + seconds * 1000 - Date.now()) / 1000));
  }, [active, room, seconds]);

  const [remaining, setRemaining] = useState(secondsLeft);
  useEffect(() => {
    setRemaining(secondsLeft());
    if (!active) return undefined;
    const timer = window.setInterval(() => setRemaining(secondsLeft()), 1000);
    return () => window.clearInterval(timer);
  }, [active, secondsLeft]);

  const markSent = useCallback(() => {
    if (!active) return;
    lastSent.set(room.roomId, Date.now());
    setRemaining(seconds);
  }, [active, room.roomId, seconds]);

  return { active, remaining, secondsLeft, markSent };
};

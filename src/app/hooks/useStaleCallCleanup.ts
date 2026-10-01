import { useEffect } from 'react';
import { useMatrixClient } from './useMatrixClient';
import { CallEmbed } from '../plugins/call';
import { StateEvent } from '../../types/matrix/room';

// Gives a call that's ending time to remove its own membership first.
const GRACE_MS = 5000;
const lockName = (roomId: string) => `angaara-call:${roomId}`;

// Clears call memberships this device left behind (a crash or dropped connection), so you
// don't stay listed in a call you're not in. Tabs share a device, so a tab's call holds a lock.
export const useStaleCallCleanup = (callEmbed?: CallEmbed) => {
  const mx = useMatrixClient();
  const activeRoom = callEmbed?.roomId;

  useEffect(() => {
    if (!activeRoom || !navigator.locks) return undefined;
    let release: () => void = () => undefined;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    navigator.locks.request(lockName(activeRoom), () => held).catch(() => undefined);
    return () => release();
  }, [activeRoom]);

  useEffect(() => {
    const clear = async () => {
      const me = mx.getSafeUserId();
      const device = mx.getDeviceId();
      const locks = await navigator.locks?.query().catch(() => undefined);
      if (!device || (navigator.locks && !locks)) return;
      const busy = new Set(locks?.held?.map((l) => l.name));
      mx.getRooms().forEach((room) => {
        if (room.roomId === activeRoom || busy.has(lockName(room.roomId))) return;
        room.currentState.getStateEvents(StateEvent.GroupCallMemberPrefix).forEach((ev) => {
          const content = ev.getContent();
          if (ev.getSender() !== me || content.device_id !== device) return;
          mx.sendStateEvent(
            room.roomId,
            StateEvent.GroupCallMemberPrefix as never,
            {},
            ev.getStateKey()
          ).catch(() => undefined);
        });
      });
    };
    const timer = window.setTimeout(clear, GRACE_MS);
    return () => window.clearTimeout(timer);
  }, [mx, activeRoom]);
};

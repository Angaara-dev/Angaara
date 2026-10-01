import { useCallback, useEffect, useRef, useState } from 'react';
import { useAtomValue } from 'jotai';
import { SyncState } from 'matrix-js-sdk';
import { CallEmbed } from '../plugins/call';
import { CallPreferences } from '../state/callPreferences';
import { mDirectAtom } from '../state/mDirectList';
import { useMatrixClient } from '../hooks/useMatrixClient';
import { useCallStart } from '../hooks/useCallEmbed';
import { useSyncState } from '../hooks/useSyncState';
import { useLivekitSupport } from '../hooks/useLivekitSupport';
import { webRTCSupported } from '../utils/rtc';

// Per tab, so a reload rejoins but a second tab or a later visit doesn't.
const KEY = 'angaara_call_rejoin';
const MAX_AGE_MS = 2 * 60 * 1000;
const STAMP_MS = 15 * 1000;

type SavedCall = { roomId: string; pref: CallPreferences; at: number };

const readSaved = (): SavedCall | undefined => {
  try {
    const saved = JSON.parse(sessionStorage.getItem(KEY) ?? 'null') as SavedCall | null;
    return saved && Date.now() - saved.at < MAX_AGE_MS ? saved : undefined;
  } catch {
    return undefined;
  }
};

type CallRejoinProps = { callEmbed?: CallEmbed; joined: boolean };
// Puts you back in the call you were in when the page reloads, like you never left.
export function CallRejoin({ callEmbed, joined }: CallRejoinProps) {
  const mx = useMatrixClient();
  const directs = useAtomValue(mDirectAtom);
  const livekitSupported = useLivekitSupport();
  const [saved, setSaved] = useState(readSaved);
  const startCall = useCallStart(saved ? directs.has(saved.roomId) : false);

  // Remember the call while in it, with the current mute state.
  useEffect(() => {
    if (!callEmbed || !joined) return undefined;
    const save = () => {
      const { microphone, video, sound } = callEmbed.control.getState();
      const entry: SavedCall = {
        roomId: callEmbed.roomId,
        pref: { microphone, video, sound },
        at: Date.now(),
      };
      try {
        sessionStorage.setItem(KEY, JSON.stringify(entry));
      } catch {
        // Storage blocked; no rejoin then.
      }
    };
    save();
    const timer = window.setInterval(save, STAMP_MS);
    window.addEventListener('pagehide', save);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('pagehide', save);
    };
  }, [callEmbed, joined]);

  // Leaving on purpose forgets it.
  const hadCall = useRef(false);
  useEffect(() => {
    if (callEmbed) hadCall.current = true;
    else if (hadCall.current) {
      hadCall.current = false;
      try {
        sessionStorage.removeItem(KEY);
      } catch {
        // Nothing saved.
      }
    }
  }, [callEmbed]);

  const tryRejoin = useCallback(() => {
    if (!saved || callEmbed || !livekitSupported) return;
    const state = mx.getSyncState();
    if (state !== SyncState.Prepared && state !== SyncState.Syncing) return;
    setSaved(undefined);
    const room = mx.getRoom(saved.roomId);
    if (!room || room.getMyMembership() !== 'join' || !webRTCSupported()) return;
    // A DM call nobody else is in anymore would just ring them again.
    const me = mx.getSafeUserId();
    const others = mx.matrixRTC
      .getRoomSession(room)
      .memberships.filter((m) => !(m.sender === me && m.deviceId === mx.getDeviceId()));
    if (directs.has(room.roomId) && others.length === 0) return;
    startCall(room, saved.pref);
  }, [mx, saved, callEmbed, directs, livekitSupported, startCall]);

  useEffect(tryRejoin, [tryRejoin]);
  useSyncState(mx, tryRejoin);

  return null;
}

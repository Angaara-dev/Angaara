import { useEffect, useState } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';
import { SetPresence } from 'matrix-js-sdk';
import { useMatrixClient } from '../../hooks/useMatrixClient';
import { useExtendedProfileSupport } from '../../hooks/useUserBanner';
import {
  ACTIVITY_PROFILE_KEY,
  ActivityStatus,
  HEARTBEAT_MS,
  chosenStatusAtom,
  encodeActivity,
  ownActivityAtom,
} from '../../hooks/useActivityStatus';

const IDLE_AFTER_MS = 10 * 60 * 1000;
const INPUT_EVENTS = ['pointerdown', 'keydown', 'mousemove', 'wheel', 'touchstart'];

export function ActivityPublisher() {
  const mx = useMatrixClient();
  const supported = useExtendedProfileSupport();
  const chosen = useAtomValue(chosenStatusAtom);
  const setOwn = useSetAtom(ownActivityAtom);
  const [inactive, setInactive] = useState(false);

  useEffect(() => {
    let timer = window.setTimeout(() => setInactive(true), IDLE_AFTER_MS);
    const onInput = () => {
      window.clearTimeout(timer);
      setInactive(false);
      timer = window.setTimeout(() => setInactive(true), IDLE_AFTER_MS);
    };
    INPUT_EVENTS.forEach((e) => window.addEventListener(e, onInput, { passive: true }));
    return () => {
      window.clearTimeout(timer);
      INPUT_EVENTS.forEach((e) => window.removeEventListener(e, onInput));
    };
  }, []);

  let state: ActivityStatus = chosen === 'invisible' ? 'offline' : chosen;
  if (state === 'online' && inactive) state = 'idle';

  useEffect(() => setOwn(state), [state, setOwn]);

  // Servers with presence on would otherwise still show you online while hidden.
  const hidden = chosen === 'invisible';
  useEffect(() => {
    mx.setSyncPresence(hidden ? SetPresence.Offline : undefined).catch(() => undefined);
    if (hidden) mx.setPresence({ presence: 'offline' }).catch(() => undefined);
  }, [mx, hidden]);

  useEffect(() => {
    if (!supported) return undefined;
    const publish = () => {
      const write =
        state === 'offline'
          ? mx.deleteExtendedProfileProperty(ACTIVITY_PROFILE_KEY)
          : mx.setExtendedProfileProperty(ACTIVITY_PROFILE_KEY, encodeActivity(state, Date.now()));
      write.catch(() => undefined);
    };
    publish();
    const heartbeat = state === 'offline' ? undefined : window.setInterval(publish, HEARTBEAT_MS);
    return () => window.clearInterval(heartbeat);
  }, [mx, supported, state]);

  return null;
}

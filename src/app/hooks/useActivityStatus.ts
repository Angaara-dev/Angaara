import { atom, useAtomValue } from 'jotai';
import { settingsAtom } from '../state/settings';
import { useSetting } from '../state/hooks/settings';
import { useMatrixClient } from './useMatrixClient';
import { useExtendedProfile } from './useUserBanner';
import { Presence, useUserPresence } from './useUserPresence';

// Online status. Kept in the profile because matrix.org turns presence off.
export type ActivityStatus = 'online' | 'idle' | 'dnd' | 'offline';
export type ChosenStatus = 'online' | 'idle' | 'dnd' | 'invisible';

export const ACTIVITY_PROFILE_KEY = 'io.angaara.activity';
export const HEARTBEAT_MS = 5 * 60 * 1000;
// A few missed heartbeats means the app was closed.
const STALE_MS = 12 * 60 * 1000;

const CHOSEN_KEY = 'angaara.chosenStatus';
const CHOSEN: ChosenStatus[] = ['online', 'idle', 'dnd', 'invisible'];
const loadChosen = (): ChosenStatus => {
  try {
    const saved = localStorage.getItem(CHOSEN_KEY) as ChosenStatus | null;
    return saved && CHOSEN.includes(saved) ? saved : 'online';
  } catch {
    return 'online';
  }
};
const baseChosenAtom = atom<ChosenStatus>(loadChosen());
export const chosenStatusAtom = atom(
  (get) => get(baseChosenAtom),
  (get, set, value: ChosenStatus) => {
    set(baseChosenAtom, value);
    try {
      localStorage.setItem(CHOSEN_KEY, value);
    } catch {
      // Just not remembered after a reload.
    }
  }
);
// What this device publishes right now, after auto-idle.
export const ownActivityAtom = atom<ActivityStatus>('online');

// Stored as "state:timestamp" so it works on servers that only take string profile values.
export const encodeActivity = (state: Exclude<ActivityStatus, 'offline'>, ts: number) =>
  `${state}:${ts}`;
const decodeActivity = (value: unknown, now: number): ActivityStatus | undefined => {
  if (typeof value !== 'string') return undefined;
  const [state, ts] = value.split(':');
  if (!['online', 'idle', 'dnd'].includes(state) || !Number(ts)) return undefined;
  return now - Number(ts) > STALE_MS ? 'offline' : (state as ActivityStatus);
};

const PRESENCE_TO_ACTIVITY: Record<Presence, ActivityStatus> = {
  [Presence.Online]: 'online',
  [Presence.Unavailable]: 'idle',
  [Presence.Offline]: 'offline',
};

// Undefined when nothing is known, so no badge is shown rather than a wrong "offline".
export const useActivityStatus = (userId: string, enabled = true): ActivityStatus | undefined => {
  const mx = useMatrixClient();
  const own = useAtomValue(ownActivityAtom);
  const profile = useExtendedProfile(userId, enabled);
  const presence = useUserPresence(userId);
  if (userId === mx.getUserId()) return own;
  const fromProfile = decodeActivity(profile?.[ACTIVITY_PROFILE_KEY], Date.now());
  if (fromProfile && fromProfile !== 'offline') return fromProfile;
  // Only trust presence the server actually sent.
  if (presence?.lastActiveTs) return PRESENCE_TO_ACTIVITY[presence.presence] ?? fromProfile;
  return fromProfile;
};

export const ACTIVITY_LABELS: Record<ActivityStatus, string> = {
  online: 'Online',
  idle: 'Idle',
  dnd: 'Do Not Disturb',
  offline: 'Offline',
};

// Hiding your status also hides typing and read receipts, same as the Editor setting.
export const useHideActivity = (): boolean => {
  const [hideActivity] = useSetting(settingsAtom, 'hideActivity');
  const chosen = useAtomValue(chosenStatusAtom);
  return hideActivity || chosen === 'invisible';
};

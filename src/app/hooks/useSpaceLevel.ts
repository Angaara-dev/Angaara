import { useCallback, useEffect } from 'react';
import { useAtomValue } from 'jotai';
import { EventType, Room } from 'matrix-js-sdk';
import { roomToParentsAtom } from '../state/room/roomToParents';
import { useStateEventCallback } from './useStateEventCallback';
import { useForceUpdate } from './useForceUpdate';

const DAY = 24 * 60 * 60 * 1000;

export type SpaceLevelInfo = {
  level: number;
  members: number;
  days: number;
  unlocks: string;
};

// Each level needs both its member count and its age in days.
export const SPACE_LEVELS: Omit<SpaceLevelInfo, 'level'>[] = [
  { members: 50, days: 30, unlocks: 'Animated banner' },
  { members: 250, days: 175, unlocks: 'Server tag' },
  { members: 1000, days: 250, unlocks: 'Animated server icon' },
  // About a year and a half.
  { members: 5000, days: 548, unlocks: 'Custom server colours' },
];

export const LEVEL_ANIMATED_BANNER = 1;
export const LEVEL_SERVER_TAG = 2;
export const LEVEL_ROLE_BADGES = 2;
export const LEVEL_ROLE_GRADIENTS = 3;
export const LEVEL_ANIMATED_ICON = 3;
export const LEVEL_SERVER_COLORS = 4;

export const getSpaceLevel = (members: number, days: number): number => {
  const index = SPACE_LEVELS.findIndex((l) => members < l.members || days < l.days);
  return index === -1 ? SPACE_LEVELS.length : index;
};

export type SpaceLevel = {
  level: number;
  members: number;
  days: number;
  // Undefined once the space is maxed out.
  next?: SpaceLevelInfo;
  // Maxed out by the deployment rather than earned.
  granted?: boolean;
};

// Set from config.json at startup: listed spaces, and spaces founders created, skip levelling.
let grantedSpaces = new Set<string>();
let founders = new Set<string>();
export const setGrantedSpaces = (spaces: string[] = [], founderIds: string[] = []) => {
  grantedSpaces = new Set(spaces);
  founders = new Set(founderIds);
};

const isGranted = (room: Room): boolean => {
  const aliases = [room.roomId, room.getCanonicalAlias(), ...room.getAltAliases()];
  if (aliases.some((id) => id && grantedSpaces.has(id))) return true;
  const creator = room.currentState.getStateEvents(EventType.RoomCreate, '')?.getSender();
  return !!creator && founders.has(creator);
};

export const getSpaceAgeDays = (room: Room): number => {
  const created = room.currentState.getStateEvents(EventType.RoomCreate, '')?.getTs();
  return created ? Math.max(0, Math.floor((Date.now() - created) / DAY)) : 0;
};

// Levels are counted by the Worker: only active Angaara users count, and age starts when it first
// saw the server, so fake accounts and backdated servers don't help. Cached here between visits.
type Counted = { members: number; days: number; at: number };
const CACHE_KEY = 'angaara_space_levels';
const STALE = 5 * 60 * 1000;
const RETRY = 60 * 1000;
const loadCounted = (): Map<string, Counted> => {
  try {
    return new Map(Object.entries(JSON.parse(localStorage.getItem(CACHE_KEY) ?? '{}')));
  } catch {
    return new Map();
  }
};
const counted = loadCounted();
const lastTry = new Map<string, number>();
const listeners = new Set<() => void>();
// Deployments without the Worker's database count in the app instead.
let countLocally = false;

const saveCounted = () => {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(Object.fromEntries(counted)));
  } catch {
    // Storage blocked; levels are fetched again next visit.
  }
};

const fetchCounted = (roomId: string) => {
  const now = Date.now();
  if (countLocally || now - (lastTry.get(roomId) ?? 0) < RETRY) return;
  lastTry.set(roomId, now);
  fetch(`${window.location.origin}/api/xp/space/${encodeURIComponent(roomId)}`)
    .then(async (res) => {
      const data = await res.json().catch(() => undefined);
      if (res.status === 501 || res.status === 404 || !data) {
        countLocally = true;
        return;
      }
      if (!res.ok || typeof data.members !== 'number' || typeof data.days !== 'number') return;
      counted.set(roomId, { members: data.members, days: data.days, at: Date.now() });
      saveCounted();
    })
    .catch(() => undefined)
    .finally(() => listeners.forEach((listener) => listener()));
};

const countsFor = (room: Room): { members: number; days: number } => {
  if (countLocally) return { members: room.getJoinedMemberCount(), days: getSpaceAgeDays(room) };
  const cached = counted.get(room.roomId);
  if (!cached || Date.now() - cached.at > STALE) fetchCounted(room.roomId);
  return cached ?? { members: 0, days: 0 };
};

// Re-renders when fresh counts arrive from the Worker.
export const useSpaceLevelUpdates = () => {
  const [, forceUpdate] = useForceUpdate();
  useEffect(() => {
    listeners.add(forceUpdate);
    return () => {
      listeners.delete(forceUpdate);
    };
  }, [forceUpdate]);
};

export const computeSpaceLevel = (room: Room): SpaceLevel => {
  const { members, days } = countsFor(room);
  if (isGranted(room)) return { level: SPACE_LEVELS.length, members, days, granted: true };
  const level = getSpaceLevel(members, days);
  const next = SPACE_LEVELS[level];
  return { level, members, days, next: next && { ...next, level: level + 1 } };
};

// Re-computed whenever someone joins or leaves the space.
export const useSpaceLevel = (room: Room): SpaceLevel => {
  const [, forceUpdate] = useForceUpdate();
  useSpaceLevelUpdates();
  useStateEventCallback(
    room.client,
    useCallback(
      (event) => {
        if (event.getRoomId() === room.roomId && event.getType() === EventType.RoomMember) {
          forceUpdate();
        }
      },
      [room, forceUpdate]
    )
  );
  return computeSpaceLevel(room);
};

// Level of the server a room belongs to: the space itself, or the best space above it.
export const useRoomServerLevel = (room: Room): number => {
  const roomToParents = useAtomValue(roomToParentsAtom);
  useSpaceLevelUpdates();
  if (room.isSpaceRoom()) return computeSpaceLevel(room).level;
  let best = 0;
  const seen = new Set<string>();
  const climb = (roomId: string) => {
    roomToParents.get(roomId)?.forEach((parentId) => {
      if (seen.has(parentId)) return;
      seen.add(parentId);
      const parent = room.client.getRoom(parentId);
      if (parent) best = Math.max(best, computeSpaceLevel(parent).level);
      climb(parentId);
    });
  };
  climb(room.roomId);
  return best;
};

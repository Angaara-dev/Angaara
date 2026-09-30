import { useCallback } from 'react';
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
  next?: SpaceLevelInfo;
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

export const computeSpaceLevel = (room: Room): SpaceLevel => {
  const members = room.getJoinedMemberCount();
  const days = getSpaceAgeDays(room);
  if (isGranted(room)) return { level: SPACE_LEVELS.length, members, days, granted: true };
  const level = getSpaceLevel(members, days);
  const next = SPACE_LEVELS[level];
  return { level, members, days, next: next && { ...next, level: level + 1 } };
};

export const useSpaceLevel = (room: Room): SpaceLevel => {
  const [, forceUpdate] = useForceUpdate();
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

export const useRoomServerLevel = (room: Room): number => {
  const roomToParents = useAtomValue(roomToParentsAtom);
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

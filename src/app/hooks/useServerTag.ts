import { Room } from 'matrix-js-sdk';
import { useMatrixClient } from './useMatrixClient';
import { readProfileString, useExtendedProfile } from './useUserBanner';
import { computeSpaceLevel, LEVEL_SERVER_TAG } from './useSpaceLevel';
import { getStateEvent } from '../utils/room';
import { StateEvent } from '../../types/matrix/room';

// Stored on the user's profile as "TAG|!spaceId", so people outside the space still see it.
export const SERVER_TAG_PROFILE_KEY = 'io.angaara.server_tag';
export const MAX_SERVER_TAG_LENGTH = 4;

export const cleanServerTag = (tag: unknown): string | undefined => {
  if (typeof tag !== 'string') return undefined;
  const clean = tag.trim().slice(0, MAX_SERVER_TAG_LENGTH);
  return clean || undefined;
};

// The tag a space offers its members, if it has one and is levelled up enough.
export const getSpaceTag = (space: Room): string | undefined => {
  if (computeSpaceLevel(space).level < LEVEL_SERVER_TAG) return undefined;
  return cleanServerTag(getStateEvent(space, StateEvent.AngaaraSpaceTag)?.getContent().tag);
};

export type ServerTag = { tag: string; spaceId: string; space?: Room };

export const parseServerTag = (value: string | undefined): ServerTag | undefined => {
  const split = value?.indexOf('|') ?? -1;
  if (!value || split < 1) return undefined;
  const tag = cleanServerTag(value.slice(0, split));
  const spaceId = value.slice(split + 1);
  return tag && spaceId.startsWith('!') ? { tag, spaceId } : undefined;
};

export const useServerTag = (userId: string, enabled = true): ServerTag | undefined => {
  const mx = useMatrixClient();
  const profile = useExtendedProfile(userId, enabled);
  const stored = parseServerTag(readProfileString(profile, [SERVER_TAG_PROFILE_KEY]));
  if (!stored) return undefined;
  const space = mx.getRoom(stored.spaceId);
  if (!space || space.getMyMembership() !== 'join') return stored;
  // We can check spaces we're in, so a removed tag, a lost level or leaving hides it.
  const member = space.getMember(userId);
  if (member && member.membership !== 'join') return undefined;
  const tag = getSpaceTag(space);
  return tag ? { tag, spaceId: stored.spaceId, space } : undefined;
};

import { useEffect } from 'react';
import { Room } from 'matrix-js-sdk';
import { useQueryClient } from '@tanstack/react-query';
import { useMatrixClient } from './useMatrixClient';
import { extendedProfileQueryKey, readProfileString, useExtendedProfile } from './useUserBanner';
import { computeSpaceLevel, LEVEL_SERVER_TAG } from './useSpaceLevel';
import { getStateEvent } from '../utils/room';
import { StateEvent } from '../../types/matrix/room';
import { isHexColor } from '../utils/accent';
import { isTagIcon } from '../components/user-profile/serverTagIcons';

// Stored on the user's profile as "TAG|!spaceId|icon|#color", so people outside the space still see it.
export const SERVER_TAG_PROFILE_KEY = 'io.angaara.server_tag';
export const MAX_SERVER_TAG_LENGTH = 4;

export const cleanServerTag = (tag: unknown): string | undefined => {
  if (typeof tag !== 'string') return undefined;
  const clean = tag.trim().slice(0, MAX_SERVER_TAG_LENGTH);
  return clean || undefined;
};

// No icon means the server's own picture.
export type TagLook = { icon?: string; color?: string };

export const cleanTagLook = (icon: unknown, color: unknown): TagLook =>
  isTagIcon(icon)
    ? { icon, color: typeof color === 'string' && isHexColor(color) ? color : undefined }
    : {};

export const getSpaceTag = (space: Room): string | undefined => {
  if (computeSpaceLevel(space).level < LEVEL_SERVER_TAG) return undefined;
  return cleanServerTag(getStateEvent(space, StateEvent.AngaaraSpaceTag)?.getContent().tag);
};

export const getSpaceTagLook = (space: Room): TagLook => {
  const content = getStateEvent(space, StateEvent.AngaaraSpaceTag)?.getContent() ?? {};
  return cleanTagLook(content.icon, content.color);
};

export const encodeServerTag = (tag: string, spaceId: string, look: TagLook): string =>
  [tag, spaceId, look.icon, look.icon && look.color].filter(Boolean).join('|');

export type ServerTag = { tag: string; spaceId: string; space?: Room } & TagLook;

export const parseServerTag = (value: string | undefined): ServerTag | undefined => {
  const [rawTag, spaceId, icon, color] = value?.split('|') ?? [];
  const tag = cleanServerTag(rawTag);
  return tag && spaceId?.startsWith('!')
    ? { tag, spaceId, ...cleanTagLook(icon, color) }
    : undefined;
};

// Many badges mount at once; each new profile value is only sent once.
const sentTags = new Set<string>();

export const useServerTag = (userId: string, enabled = true): ServerTag | undefined => {
  const mx = useMatrixClient();
  const queryClient = useQueryClient();
  const profile = useExtendedProfile(userId, enabled);
  const raw = readProfileString(profile, [SERVER_TAG_PROFILE_KEY]);
  const stored = parseServerTag(raw);
  const space = stored ? mx.getRoom(stored.spaceId) : null;
  const inSpace = !!space && space.getMyMembership() === 'join';
  const member = inSpace ? space?.getMember(userId) : undefined;
  const tag = inSpace && space ? getSpaceTag(space) : undefined;
  const live: ServerTag | undefined =
    stored && space && tag
      ? { tag, spaceId: stored.spaceId, space, ...getSpaceTagLook(space) }
      : undefined;

  // Keep your own profile copy in step when admins change the tag, for people outside the space.
  const fresh = live && encodeServerTag(live.tag, live.spaceId, live);
  const mine = userId === mx.getSafeUserId();
  useEffect(() => {
    if (!mine || !fresh || !raw || fresh === raw || sentTags.has(fresh)) return;
    sentTags.add(fresh);
    mx.setExtendedProfileProperty(SERVER_TAG_PROFILE_KEY, fresh)
      .then(() => queryClient.invalidateQueries({ queryKey: extendedProfileQueryKey(userId) }))
      .catch(() => undefined);
  }, [mx, queryClient, mine, fresh, raw, userId]);

  if (!stored) return undefined;
  if (!inSpace) return stored;
  // We can check spaces we're in, so a removed tag, a lost level or leaving hides it.
  if (member && member.membership !== 'join') return undefined;
  return live;
};

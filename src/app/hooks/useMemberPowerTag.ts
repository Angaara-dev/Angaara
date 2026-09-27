import { useCallback, useMemo } from 'react';
import { MatrixClient, Room, RoomMember } from 'matrix-js-sdk';
import { getPowerLevelTag, PowerLevelTags, usePowerLevelTags } from './usePowerLevelTags';
import { IPowerLevels, readPowerLevel } from './usePowerLevels';
import { MemberPowerTag, MemberPowerTagIcon } from '../../types/matrix/room';
import { useRoomCreatorsTag } from './useRoomCreatorsTag';
import { LEVEL_ROLE_BADGES, LEVEL_ROLE_GRADIENTS, useRoomServerLevel } from './useSpaceLevel';
import { ThemeKind } from './useTheme';
import { accessibleColor } from '../plugins/color';

export type GetMemberPowerTag = (userId: string) => MemberPowerTag;

// Role badges and two-colour roles are server level perks; below that a role is one plain colour.
export const gatePowerTag = (tag: MemberPowerTag, level: number): MemberPowerTag => {
  if (level >= LEVEL_ROLE_GRADIENTS) return tag;
  return {
    name: tag.name,
    color: tag.color,
    icon: level >= LEVEL_ROLE_BADGES ? tag.icon : undefined,
  };
};

export const useGatedPowerTags = (room: Room, tags: PowerLevelTags): PowerLevelTags => {
  const level = useRoomServerLevel(room);
  return useMemo(() => {
    const gated: PowerLevelTags = {};
    Object.entries(tags).forEach(([power, tag]) => {
      gated[Number(power)] = gatePowerTag(tag, level);
    });
    return gated;
  }, [tags, level]);
};

export const useGatedCreatorsTag = (room: Room): MemberPowerTag => {
  const tag = useRoomCreatorsTag();
  const level = useRoomServerLevel(room);
  return useMemo(() => gatePowerTag(tag, level), [tag, level]);
};

export const useGetMemberPowerTag = (
  room: Room,
  creators: Set<string>,
  powerLevels: IPowerLevels
) => {
  const creatorsTag = useGatedCreatorsTag(room);
  const powerLevelTags = useGatedPowerTags(room, usePowerLevelTags(room, powerLevels));

  const getMemberPowerTag: GetMemberPowerTag = useCallback(
    (userId) => {
      if (creators.has(userId)) {
        return creatorsTag;
      }

      const power = readPowerLevel.user(powerLevels, userId);
      return getPowerLevelTag(powerLevelTags, power);
    },
    [creators, creatorsTag, powerLevels, powerLevelTags]
  );

  return getMemberPowerTag;
};

export const getPowerTagIconSrc = (
  mx: MatrixClient,
  useAuthentication: boolean,
  icon: MemberPowerTagIcon
): string | undefined =>
  icon?.key?.startsWith('mxc://')
    ? mx.mxcUrlToHttp(icon.key, 96, 96, 'scale', undefined, undefined, useAuthentication) ?? '🌻'
    : icon?.key;

export const useAccessiblePowerTagColors = (
  themeKind: ThemeKind,
  creatorsTag: MemberPowerTag,
  powerLevelTags: PowerLevelTags
): Map<string, string> => {
  const accessibleColors: Map<string, string> = useMemo(() => {
    const colors: Map<string, string> = new Map();
    [creatorsTag, ...Object.values(powerLevelTags)].forEach((tag) => {
      [tag.color, tag.gradient].forEach((color) => {
        if (color) colors.set(color, accessibleColor(themeKind, color));
      });
    });

    return colors;
  }, [powerLevelTags, creatorsTag, themeKind]);

  return accessibleColors;
};

export const useFlattenPowerTagMembers = (
  members: RoomMember[],
  getTag: GetMemberPowerTag
): Array<MemberPowerTag | RoomMember> => {
  const PLTagOrRoomMember = useMemo(() => {
    let prevTag: MemberPowerTag | undefined;
    const tagOrMember: Array<MemberPowerTag | RoomMember> = [];
    members.forEach((member) => {
      const tag = getTag(member.userId);
      if (tag !== prevTag) {
        prevTag = tag;
        tagOrMember.push(tag);
      }
      tagOrMember.push(member);
    });
    return tagOrMember;
  }, [members, getTag]);

  return PLTagOrRoomMember;
};

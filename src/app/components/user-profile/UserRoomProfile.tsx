import { Box, Button, color, config, Icon, Icons, Text } from 'folds';
import React from 'react';
import { useSetAtom } from 'jotai';
import { useNavigate } from 'react-router-dom';
import { UserHero, UserHeroName } from './UserHero';
import { getMxIdServer, mxcUrlToHttp } from '../../utils/matrix';
import { getMemberAvatarMxc, getMemberDisplayName } from '../../utils/room';
import { useMatrixClient } from '../../hooks/useMatrixClient';
import { useMediaAuthentication } from '../../hooks/useMediaAuthentication';
import { usePowerLevels } from '../../hooks/usePowerLevels';
import { useRoom } from '../../hooks/useRoom';
import { useSpaceOptionally } from '../../hooks/useSpace';
import { useUserXp } from '../../hooks/useUserXp';
import { AngaaraLogo } from '../angaara-logo';
import { ACTIVITY_LABELS, useActivityStatus } from '../../hooks/useActivityStatus';
import { StatusIcon } from '../presence';
import { IgnoredUserAlert, MutualRoomsChip, OptionsChip, ServerChip, ShareChip } from './UserChips';
import { useCloseUserRoomProfile } from '../../state/hooks/userRoomProfile';
import { PowerChip } from './PowerChip';
import { UserBio } from './UserBio';
import { useUserStatus } from '../../hooks/useUserStatus';
import {
  profileThemeBackground,
  profileThemeVars,
  useProfileTheme,
} from '../../hooks/useProfileTheme';
import { ThemeKind, useTheme } from '../../hooks/useTheme';
import { themeStop } from '../../utils/accent';
import { UserInviteAlert, UserBanAlert, UserModeration, UserKickAlert } from './UserModeration';
import { useIgnoredUsers } from '../../hooks/useIgnoredUsers';
import { useMembership } from '../../hooks/useMembership';
import { Membership } from '../../../types/matrix/room';
import { useRoomCreators } from '../../hooks/useRoomCreators';
import { useRoomPermissions } from '../../hooks/useRoomPermissions';
import { useMemberPowerCompare } from '../../hooks/useMemberPowerCompare';
import { CreatorChip } from './CreatorChip';
import { ReportUserChip } from './ReportUser';
import { useUserBannerUrl } from '../../hooks/useUserBanner';
import { SettingsPages, userSettingsPageAtom } from '../../features/settings';
import { getDirectCreatePath, withSearchParam } from '../../pages/pathUtils';
import { DirectCreateSearchParams } from '../../pages/paths';

const formatDay = (ts: number) =>
  new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

type UserRoomProfileProps = {
  userId: string;
};
export function UserRoomProfile({ userId }: UserRoomProfileProps) {
  const mx = useMatrixClient();
  const useAuthentication = useMediaAuthentication();
  const navigate = useNavigate();
  const closeUserRoomProfile = useCloseUserRoomProfile();
  const ignoredUsers = useIgnoredUsers();
  const ignored = ignoredUsers.includes(userId);

  const room = useRoom();
  const space = useSpaceOptionally();
  const powerLevels = usePowerLevels(room);
  const creators = useRoomCreators(room);

  const permissions = useRoomPermissions(creators, powerLevels);
  const { hasMorePower } = useMemberPowerCompare(creators, powerLevels);

  const myUserId = mx.getSafeUserId();
  const creator = creators.has(userId);

  const canKickUser = permissions.action('kick', myUserId) && hasMorePower(myUserId, userId);
  const canBanUser = permissions.action('ban', myUserId) && hasMorePower(myUserId, userId);
  const canUnban = permissions.action('ban', myUserId);
  const canInvite = permissions.action('invite', myUserId);

  const member = room.getMember(userId);
  const membership = useMembership(room, userId);

  const server = getMxIdServer(userId);
  const displayName = getMemberDisplayName(room, userId);
  const avatarMxc = getMemberAvatarMxc(room, userId);
  const avatarUrl = (avatarMxc && mxcUrlToHttp(mx, avatarMxc, useAuthentication)) ?? undefined;
  const bannerUrl = useUserBannerUrl(userId);

  const activity = useActivityStatus(userId);
  const status = useUserStatus(userId);
  const profileTheme = useProfileTheme(userId);
  const dark = useTheme().kind === ThemeKind.Dark;

  const setUserSettingsPage = useSetAtom(userSettingsPageAtom);
  const handleEditProfile = () => {
    closeUserRoomProfile();
    setUserSettingsPage(SettingsPages.AccountPage);
  };

  const handleMessage = () => {
    closeUserRoomProfile();
    const directSearchParam: DirectCreateSearchParams = {
      userId,
    };
    navigate(withSearchParam(getDirectCreatePath(), directSearchParam));
  };

  const joinedSpace = space ?? room;
  const joinEvent = joinedSpace.getMember(userId)?.events.member;
  // Only a real join counts; later name or avatar changes reuse the member event.
  const joinedAt =
    joinEvent?.getContent().membership === Membership.Join &&
    joinEvent.getPrevContent().membership !== Membership.Join
      ? joinEvent.getTs()
      : undefined;
  const angaaraSince = useUserXp(userId)?.since;
  const cardBackground = profileTheme
    ? 'rgba(0, 0, 0, 0.28)'
    : `color-mix(in srgb, ${color.SurfaceVariant.Container} 80%, transparent)`;

  return (
    <Box
      direction="Column"
      style={
        profileTheme && {
          ...profileThemeVars(profileTheme, dark),
          background: profileThemeBackground(profileTheme, dark),
          ['--angaara-profile-ring' as string]: themeStop(profileTheme.top, dark),
        }
      }
    >
      <UserHero userId={userId} avatarUrl={avatarUrl} bannerUrl={bannerUrl} activity={activity} />
      <Box direction="Column" gap="400" style={{ padding: config.space.S400 }}>
        <Box direction="Column" gap="200">
          <UserHeroName displayName={displayName} userId={userId} />
          {activity && (
            <Box alignItems="Center" gap="200">
              <StatusIcon status={activity} size={12} decorative />
              <Text size="T300" priority="400">
                {ACTIVITY_LABELS[activity]}
              </Text>
            </Box>
          )}
          {status && (
            <Text size="T300" style={{ overflowWrap: 'anywhere' }}>
              {status}
            </Text>
          )}
        </Box>
        {userId !== myUserId ? (
          <Button
            variant="Primary"
            fill="Solid"
            radii="400"
            before={<Icon size="100" src={Icons.Message} filled />}
            onClick={handleMessage}
          >
            <Text size="B400">Message</Text>
          </Button>
        ) : (
          <Button
            variant="Primary"
            fill="Solid"
            radii="400"
            before={<Icon size="100" src={Icons.Pencil} />}
            onClick={handleEditProfile}
          >
            <Text size="B400">Edit Profile</Text>
          </Button>
        )}
        <Box
          direction="Column"
          gap="400"
          style={{
            padding: config.space.S400,
            borderRadius: config.radii.R500,
            background: cardBackground,
          }}
        >
          <UserBio userId={userId} />
          {(angaaraSince || joinedAt) && (
            <Box direction="Column" gap="100">
              <Text size="L400">Member Since</Text>
              <Box alignItems="Center" gap="300" wrap="Wrap">
                {angaaraSince && (
                  <Box alignItems="Center" gap="100">
                    <AngaaraLogo size={16} />
                    <Text size="T300">{formatDay(angaaraSince)}</Text>
                  </Box>
                )}
                {joinedAt && (
                  <Box alignItems="Center" gap="100" title={`Joined ${joinedSpace.name}`}>
                    <Icon size="100" src={space ? Icons.Space : Icons.Hash} />
                    <Text size="T300">{formatDay(joinedAt)}</Text>
                  </Box>
                )}
              </Box>
            </Box>
          )}
          <Box direction="Column" gap="200">
            <Text size="L400">Roles</Text>
            <Box alignItems="Center" gap="200" wrap="Wrap">
              {creator ? <CreatorChip /> : <PowerChip userId={userId} />}
            </Box>
          </Box>
        </Box>
        <Box alignItems="Center" gap="200" wrap="Wrap">
          {server && <ServerChip server={server} />}
          <ShareChip userId={userId} />
          {userId !== myUserId && <MutualRoomsChip userId={userId} />}
          {userId !== myUserId && <OptionsChip userId={userId} />}
          {userId !== myUserId && <ReportUserChip userId={userId} room={room} />}
        </Box>
        {ignored && <IgnoredUserAlert />}
        {member && membership === Membership.Ban && (
          <UserBanAlert
            userId={userId}
            reason={member.events.member?.getContent().reason}
            canUnban={canUnban}
            bannedBy={member.events.member?.getSender()}
            ts={member.events.member?.getTs()}
          />
        )}
        {member &&
          membership === Membership.Leave &&
          member.events.member &&
          member.events.member.getSender() !== userId && (
            <UserKickAlert
              reason={member.events.member?.getContent().reason}
              kickedBy={member.events.member?.getSender()}
              ts={member.events.member?.getTs()}
            />
          )}
        {member && membership === Membership.Invite && (
          <UserInviteAlert
            userId={userId}
            reason={member.events.member?.getContent().reason}
            canKick={canKickUser}
            invitedBy={member.events.member?.getSender()}
            ts={member.events.member?.getTs()}
          />
        )}
        <UserModeration
          userId={userId}
          canInvite={canInvite && membership === Membership.Leave}
          canKick={canKickUser && membership === Membership.Join}
          canBan={canBanUser && membership !== Membership.Ban}
        />
      </Box>
    </Box>
  );
}

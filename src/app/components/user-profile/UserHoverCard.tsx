import React, { ReactNode, RefCallback } from 'react';
import { Room } from 'matrix-js-sdk';
import { useQueryClient } from '@tanstack/react-query';
import {
  Avatar,
  Box,
  Icon,
  Icons,
  Text,
  Tooltip,
  TooltipProvider,
  color,
  config,
  toRem,
} from 'folds';
import { useMatrixClient } from '../../hooks/useMatrixClient';
import { useMediaAuthentication } from '../../hooks/useMediaAuthentication';
import { extendedProfileQuery, useUserBannerUrl } from '../../hooks/useUserBanner';
import { getMemberAvatarMxc, getMemberDisplayName } from '../../utils/room';
import { getMxIdLocalPart, mxcUrlToHttp } from '../../utils/matrix';
import { UserAvatar } from '../user-avatar';
import { UserBio } from './UserBio';
import { UserBadges } from './UserBadges';
import { bannerFallback } from './bannerFallback';
import { ServerTagBadge } from './ServerTagBadge';
import { useUserStatus } from '../../hooks/useUserStatus';
import {
  profileThemeBackground,
  profileThemeVars,
  useProfileTheme,
} from '../../hooks/useProfileTheme';
import { ThemeKind, useTheme } from '../../hooks/useTheme';
import { useProfileEffect } from '../../hooks/useProfileEffect';
import { ProfileEffect } from '../profile-effect';

type HoverCardContentProps = {
  room: Room;
  userId: string;
  tagName?: string;
  tagColor?: string;
};
function HoverCardContent({ room, userId, tagName, tagColor }: HoverCardContentProps) {
  const mx = useMatrixClient();
  const useAuthentication = useMediaAuthentication();
  const bannerUrl = useUserBannerUrl(userId);
  const status = useUserStatus(userId);
  const profileTheme = useProfileTheme(userId);
  const profileEffect = useProfileEffect(userId);
  const dark = useTheme().kind === ThemeKind.Dark;

  const displayName = getMemberDisplayName(room, userId) ?? getMxIdLocalPart(userId) ?? userId;
  const avatarMxc = getMemberAvatarMxc(room, userId);
  const avatarUrl = avatarMxc
    ? mxcUrlToHttp(mx, avatarMxc, useAuthentication, 96, 96, 'crop') ?? undefined
    : undefined;

  return (
    <Box
      direction="Column"
      style={{
        position: 'relative',
        width: toRem(280),
        ...(profileTheme && profileThemeVars(profileTheme, dark)),
        background: profileTheme && profileThemeBackground(profileTheme, dark),
        borderRadius: config.radii.R400,
      }}
    >
      <div
        style={{
          height: toRem(72),
          backgroundColor: bannerFallback(userId),
          borderRadius: `${config.radii.R400} ${config.radii.R400} 0 0`,
          overflow: 'hidden',
        }}
      >
        {bannerUrl && (
          <img
            src={bannerUrl}
            alt=""
            style={{ width: '100%', height: '100%', objectFit: 'cover', pointerEvents: 'none' }}
          />
        )}
      </div>
      <Box direction="Column" gap="200" style={{ padding: config.space.S300 }}>
        <Avatar
          size="400"
          style={{
            marginTop: `-${toRem(36)}`,
            outline: `${config.borderWidth.B600} solid ${color.Surface.Container}`,
          }}
        >
          <UserAvatar
            userId={userId}
            src={avatarUrl}
            alt={displayName}
            renderFallback={() => <Icon size="300" src={Icons.User} filled />}
          />
        </Avatar>
        <Box direction="Column">
          <Text size="H5" truncate>
            {displayName}
          </Text>
          <Text size="T200" priority="300" truncate>
            {userId}
          </Text>
        </Box>
        <ServerTagBadge userId={userId} size="normal" />
        <UserBadges userId={userId} />
        {status && (
          <Text size="T200" style={{ overflowWrap: 'anywhere' }}>
            {status}
          </Text>
        )}
        {tagName && (
          <Box alignItems="Center" gap="100">
            <span
              style={{
                width: toRem(8),
                height: toRem(8),
                borderRadius: '50%',
                backgroundColor: tagColor ?? color.Secondary.Main,
                flexShrink: 0,
              }}
            />
            <Text size="T200">{tagName}</Text>
          </Box>
        )}
        <UserBio userId={userId} maxLines={3} />
      </Box>
      {profileEffect && <ProfileEffect effect={profileEffect} />}
    </Box>
  );
}

type UserHoverCardProps = HoverCardContentProps & {
  children: (triggerRef: RefCallback<HTMLElement | SVGElement>) => ReactNode;
};
export function UserHoverCard({ children, ...props }: UserHoverCardProps) {
  const mx = useMatrixClient();
  const queryClient = useQueryClient();
  // Load the profile during the hover delay; the card grows upward if it changes size once open.
  const prefetch = () => queryClient.prefetchQuery(extendedProfileQuery(mx, props.userId));

  return (
    <TooltipProvider
      position="Top"
      align="Start"
      offset={8}
      delay={400}
      tooltip={
        <Tooltip variant="Surface" style={{ padding: 0 }}>
          <HoverCardContent {...props} />
        </Tooltip>
      }
    >
      {(triggerRef) => (
        <span style={{ display: 'contents' }} onPointerOver={prefetch}>
          {children(triggerRef)}
        </span>
      )}
    </TooltipProvider>
  );
}

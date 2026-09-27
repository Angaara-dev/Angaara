import React, { useState } from 'react';
import {
  Avatar,
  Box,
  Icon,
  Icons,
  Modal,
  Overlay,
  OverlayBackdrop,
  OverlayCenter,
  Text,
} from 'folds';
import classNames from 'classnames';
import FocusTrap from 'focus-trap-react';
import * as css from './styles.css';
import { UserAvatar } from '../user-avatar';
import { getMxIdLocalPart } from '../../utils/matrix';
import { BreakWord, LineClamp3 } from '../../styles/Text.css';
import { ActivityStatus } from '../../hooks/useActivityStatus';
import { AvatarPresence, StatusIcon } from '../presence';
import { ImageViewer } from '../image-viewer';
import { stopPropagation } from '../../utils/keyboard';
import { ServerTagBadge } from './ServerTagBadge';
import { bannerFallback } from './bannerFallback';
import { UserBadges } from './UserBadges';

type UserHeroProps = {
  userId: string;
  avatarUrl?: string;
  bannerUrl?: string;
  activity?: ActivityStatus;
};
export function UserHero({ userId, avatarUrl, bannerUrl, activity }: UserHeroProps) {
  const [viewAvatar, setViewAvatar] = useState<string>();

  return (
    <Box direction="Column" className={css.UserHero}>
      <div
        className={css.UserHeroCoverContainer}
        style={{
          backgroundColor: bannerFallback(userId),
          filter: avatarUrl || bannerUrl ? undefined : 'brightness(50%)',
        }}
      >
        {bannerUrl && (
          <img className={css.UserHeroBanner} src={bannerUrl} alt="" draggable="false" />
        )}
        {!bannerUrl && avatarUrl && (
          <img className={css.UserHeroCover} src={avatarUrl} alt={userId} draggable="false" />
        )}
      </div>
      <div className={css.UserHeroAvatarContainer}>
        <AvatarPresence
          className={css.UserAvatarContainer}
          badge={activity && <StatusIcon status={activity} size={18} />}
        >
          <Avatar
            as={avatarUrl ? 'button' : 'div'}
            onClick={avatarUrl ? () => setViewAvatar(avatarUrl) : undefined}
            className={css.UserHeroAvatar}
            size="500"
            radii="Pill"
          >
            <UserAvatar
              className={css.UserHeroAvatarImg}
              userId={userId}
              src={avatarUrl}
              alt={userId}
              renderFallback={() => <Icon size="500" src={Icons.User} filled />}
            />
          </Avatar>
        </AvatarPresence>
        {viewAvatar && (
          <Overlay open backdrop={<OverlayBackdrop />}>
            <OverlayCenter>
              <FocusTrap
                focusTrapOptions={{
                  initialFocus: false,
                  onDeactivate: () => setViewAvatar(undefined),
                  clickOutsideDeactivates: true,
                  escapeDeactivates: stopPropagation,
                }}
              >
                <Modal size="500" onContextMenu={(evt: any) => evt.stopPropagation()}>
                  <ImageViewer
                    src={viewAvatar}
                    alt={userId}
                    requestClose={() => setViewAvatar(undefined)}
                  />
                </Modal>
              </FocusTrap>
            </OverlayCenter>
          </Overlay>
        )}
      </div>
    </Box>
  );
}

type UserHeroNameProps = {
  displayName?: string;
  userId: string;
};
export function UserHeroName({ displayName, userId }: UserHeroNameProps) {
  const username = getMxIdLocalPart(userId);

  return (
    <Box grow="Yes" direction="Column" gap="0">
      <Box alignItems="Baseline" gap="200" wrap="Wrap">
        <Text
          size="H3"
          className={classNames(BreakWord, LineClamp3)}
          title={displayName ?? username}
        >
          {displayName ?? username ?? userId}
        </Text>
      </Box>
      <Box alignItems="Center" gap="100" wrap="Wrap">
        <Text size="T200" className={classNames(BreakWord, LineClamp3)} title={username}>
          @{username}
        </Text>
        <ServerTagBadge userId={userId} size="normal" />
        <UserBadges userId={userId} size="small" />
      </Box>
    </Box>
  );
}

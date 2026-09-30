import React, { Fragment, ReactNode, useRef, useState } from 'react';
import FocusTrap from 'focus-trap-react';
import {
  Avatar,
  Box,
  Button,
  color,
  config,
  Icon,
  IconButton,
  Icons,
  IconSrc,
  Overlay,
  OverlayBackdrop,
  OverlayCenter,
  Scroll,
  Text,
  toRem,
} from 'folds';
import { useMatrixClient } from '../../hooks/useMatrixClient';
import { useMediaAuthentication } from '../../hooks/useMediaAuthentication';
import { useUserProfile } from '../../hooks/useUserProfile';
import { useUserBannerUrl } from '../../hooks/useUserBanner';
import { getMxIdLocalPart, mxcUrlToHttp } from '../../utils/matrix';
import { nameInitials } from '../../utils/common';
import { UserAvatar } from '../../components/user-avatar';
import { LogoutDialog } from '../../components/LogoutDialog';
import { stopPropagation } from '../../utils/keyboard';
import * as css from './styles.css';
import { bannerFallback } from '../../components/user-profile/bannerFallback';
import { useScrollFade } from '../../hooks/useScrollFade';
import { ScrollFade } from '../../styles/ScrollFade.css';

type MobileItem<P> = { page: P; name: string; icon: IconSrc };
type MobileGroupDef<P> = { title: string; items: MobileItem<P>[] };

function Row({ icon, label, onClick }: { icon: ReactNode; label: string; onClick: () => void }) {
  return (
    <button type="button" className={css.MobileRow} onClick={onClick}>
      {icon}
      <Text as="span" size="T400" style={{ flexGrow: 1 }} truncate>
        {label}
      </Text>
      <Icon src={Icons.ChevronRight} size="100" />
    </button>
  );
}

type MobileSettingsHomeProps<P> = {
  groups: MobileGroupDef<P>[];
  profilePage: P;
  onSelect: (page: P) => void;
  requestClose: () => void;
};
export function MobileSettingsHome<P>({
  groups,
  profilePage,
  onSelect,
  requestClose,
}: MobileSettingsHomeProps<P>) {
  const scrollRef = useRef<HTMLDivElement>(null);
  useScrollFade(scrollRef);
  const mx = useMatrixClient();
  const useAuthentication = useMediaAuthentication();
  const userId = mx.getSafeUserId();
  const profile = useUserProfile(userId);
  const bannerUrl = useUserBannerUrl(userId);
  const [logout, setLogout] = useState(false);

  const displayName = profile.displayName ?? getMxIdLocalPart(userId) ?? userId;
  const avatarUrl = profile.avatarUrl
    ? mxcUrlToHttp(mx, profile.avatarUrl, useAuthentication, 160, 160, 'crop') ?? undefined
    : undefined;

  return (
    <Box grow="Yes" direction="Column" style={{ height: '100%' }}>
      <Box
        shrink="No"
        alignItems="Center"
        gap="200"
        style={{ padding: `${config.space.S300} ${config.space.S200}` }}
      >
        <IconButton onClick={requestClose} variant="Background" aria-label="Close">
          <Icon src={Icons.Cross} />
        </IconButton>
        <Text size="H3">Settings</Text>
      </Box>
      <Box grow="Yes" style={{ minHeight: 0 }}>
        <Scroll ref={scrollRef} className={ScrollFade} size="0" hideTrack visibility="Hover">
          <Box
            direction="Column"
            gap="500"
            style={{ padding: `${config.space.S200} ${config.space.S400} ${config.space.S700}` }}
          >
            <div className={css.MobileGroup}>
              <div
                className={css.MobileProfileBanner}
                style={{
                  backgroundColor: bannerFallback(userId),
                  backgroundImage: bannerUrl ? `url("${bannerUrl}")` : undefined,
                }}
              />
              <Box direction="Column" gap="300" style={{ padding: config.space.S400 }}>
                <div className={css.MobileProfileAvatar}>
                  <Avatar size="500" radii="Pill" style={{ width: toRem(80), height: toRem(80) }}>
                    <UserAvatar
                      userId={userId}
                      src={avatarUrl}
                      alt={displayName}
                      renderFallback={() => <Text size="H3">{nameInitials(displayName)}</Text>}
                    />
                  </Avatar>
                </div>
                <Box direction="Column">
                  <Text size="H3" truncate>
                    {displayName}
                  </Text>
                  <Text size="T300" priority="300" truncate>
                    {userId}
                  </Text>
                </Box>
                <Button
                  variant="Primary"
                  radii="400"
                  before={<Icon src={Icons.Pencil} size="100" />}
                  onClick={() => onSelect(profilePage)}
                >
                  <Text size="B400">Edit Profile</Text>
                </Button>
              </Box>
            </div>

            {groups.map((group) => (
              <Box key={group.title} direction="Column" gap="200">
                <Text size="L400" priority="300" style={{ paddingLeft: config.space.S100 }}>
                  {group.title}
                </Text>
                <div className={css.MobileGroup}>
                  {group.items.map((item, index) => (
                    <Fragment key={item.name}>
                      {index > 0 && <div className={css.MobileRowDivider} />}
                      <Row
                        icon={<Icon src={item.icon} size="200" />}
                        label={item.name}
                        onClick={() => onSelect(item.page)}
                      />
                    </Fragment>
                  ))}
                </div>
              </Box>
            ))}

            <div className={css.MobileGroup}>
              <button
                type="button"
                className={css.MobileRow}
                style={{ color: color.Critical.Main }}
                onClick={() => setLogout(true)}
              >
                <Icon src={Icons.Power} size="200" />
                <Text as="span" size="T400">
                  Log Out
                </Text>
              </button>
            </div>
          </Box>
        </Scroll>
      </Box>
      {logout && (
        <Overlay open backdrop={<OverlayBackdrop />}>
          <OverlayCenter>
            <FocusTrap
              focusTrapOptions={{
                onDeactivate: () => setLogout(false),
                clickOutsideDeactivates: true,
                escapeDeactivates: stopPropagation,
              }}
            >
              <LogoutDialog handleClose={() => setLogout(false)} />
            </FocusTrap>
          </OverlayCenter>
        </Overlay>
      )}
    </Box>
  );
}

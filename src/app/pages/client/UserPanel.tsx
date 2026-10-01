import React, { MouseEventHandler, useRef, useState } from 'react';
import FocusTrap from 'focus-trap-react';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { isKeyHotkey } from 'is-hotkey';
import {
  Avatar,
  Box,
  Icon,
  IconButton,
  Icons,
  Line,
  Menu,
  MenuItem,
  PopOut,
  RectCords,
  Text,
  Tooltip,
  TooltipProvider,
  color,
  config,
  toRem,
} from 'folds';
import * as css from './UserPanel.css';
import { useMatrixClient } from '../../hooks/useMatrixClient';
import { useMediaAuthentication } from '../../hooks/useMediaAuthentication';
import { useUserProfile } from '../../hooks/useUserProfile';
import { useUserBannerUrl, useUserPanelBgUrl } from '../../hooks/useUserBanner';
import { useUserStatus } from '../../hooks/useUserStatus';
import { getMxIdLocalPart, mxcUrlToHttp } from '../../utils/matrix';
import { nameInitials } from '../../utils/common';
import { copyToClipboard } from '../../utils/dom';
import { stopPropagation } from '../../utils/keyboard';
import { UserAvatar } from '../../components/user-avatar';
import { UserBadges } from '../../components/user-profile/UserBadges';
import { UserBio } from '../../components/user-profile/UserBio';
import { StatusDialog } from '../../components/user-profile/StatusDialog';
import { SettingsPages, userSettingsPageAtom } from '../../features/settings';
import { ChosenStatus, chosenStatusAtom, ownActivityAtom } from '../../hooks/useActivityStatus';
import { StatusIcon } from '../../components/presence';
import { profileThemeBackground, useProfileTheme } from '../../hooks/useProfileTheme';
import { ThemeKind, useTheme } from '../../hooks/useTheme';
import { varName } from '../../utils/accent';
import { bannerFallback } from '../../components/user-profile/bannerFallback';

const STATUS_OPTIONS: { value: ChosenStatus; label: string; hint?: string }[] = [
  { value: 'online', label: 'Online' },
  { value: 'idle', label: 'Idle' },
  { value: 'dnd', label: 'Do Not Disturb', hint: 'Mutes desktop notifications and sounds' },
  {
    value: 'invisible',
    label: 'Hide Online Status',
    hint: 'No status, read receipts or typing',
  },
];

const STATUS_LABELS: Record<ChosenStatus, string> = {
  online: 'Online',
  idle: 'Idle',
  dnd: 'Do Not Disturb',
  invisible: 'Invisible',
};

export function UserPanel() {
  const mx = useMatrixClient();
  const useAuthentication = useMediaAuthentication();
  const userId = mx.getSafeUserId();
  const profile = useUserProfile(userId);
  const bannerUrl = useUserBannerUrl(userId);
  const panelBgUrl = useUserPanelBgUrl(userId);
  const status = useUserStatus(userId);
  const profileTheme = useProfileTheme(userId);
  const dark = useTheme().kind === ThemeKind.Dark;
  const openSettings = useSetAtom(userSettingsPageAtom);
  const [chosen, setChosen] = useAtom(chosenStatusAtom);
  const activity = useAtomValue(ownActivityAtom);

  const [menuCords, setMenuCords] = useState<RectCords>();
  const [editingStatus, setEditingStatus] = useState(false);

  const displayName = profile.displayName ?? getMxIdLocalPart(userId) ?? userId;
  const avatarUrl = profile.avatarUrl
    ? mxcUrlToHttp(mx, profile.avatarUrl, useAuthentication, 96, 96, 'crop') ?? undefined
    : undefined;
  const avatar = (size: '300' | '400') => (
    <Avatar size={size} radii="Pill">
      <UserAvatar
        userId={userId}
        src={avatarUrl}
        alt={displayName}
        renderFallback={() => <Text size="H6">{nameInitials(displayName)}</Text>}
      />
    </Avatar>
  );

  const closeMenu = () => setMenuCords(undefined);
  const meRef = useRef<HTMLButtonElement>(null);
  const openMenu: MouseEventHandler<HTMLButtonElement> = (evt) => {
    if (menuCords) closeMenu();
    else setMenuCords(evt.currentTarget.getBoundingClientRect());
  };
  const run = (action: () => void) => () => {
    closeMenu();
    action();
  };

  return (
    <Box className={css.UserPanel} data-has-bg={!!panelBgUrl} alignItems="Center" gap="100">
      {panelBgUrl && <img className={css.Background} src={panelBgUrl} alt="" />}
      <PopOut
        // PopOut covers the screen with an invisible layer; let taps through it so a tap on the
        // bar reaches the bar's toggle instead of closing and instantly reopening the card.
        style={{ pointerEvents: 'none' }}
        anchor={menuCords}
        position="Top"
        align="Start"
        offset={8}
        content={
          <FocusTrap
            focusTrapOptions={{
              initialFocus: false,
              onDeactivate: closeMenu,
              // Taps on the bar are left to its toggle, so they don't close and reopen the card.
              clickOutsideDeactivates: (evt: MouseEvent | TouchEvent) =>
                !(evt.target instanceof Node && meRef.current?.contains(evt.target)),
              allowOutsideClick: (evt: MouseEvent | TouchEvent) =>
                evt.target instanceof Node && !!meRef.current?.contains(evt.target),
              escapeDeactivates: stopPropagation,
              isKeyForward: (evt: KeyboardEvent) => isKeyHotkey('arrowdown', evt),
              isKeyBackward: (evt: KeyboardEvent) => isKeyHotkey('arrowup', evt),
            }}
          >
            <Menu
              className={css.MenuCard}
              style={
                profileTheme && {
                  background: profileThemeBackground(profileTheme, dark),
                  [varName(color.Surface.Container) ?? '']: 'transparent',
                  [varName(color.Surface.ContainerHover) ?? '']: dark
                    ? 'rgba(255, 255, 255, 0.08)'
                    : 'rgba(0, 0, 0, 0.05)',
                  [varName(color.Surface.ContainerActive) ?? '']: dark
                    ? 'rgba(255, 255, 255, 0.14)'
                    : 'rgba(0, 0, 0, 0.09)',
                }
              }
            >
              <div
                className={css.MenuBanner}
                style={{
                  backgroundColor: bannerFallback(userId),
                  backgroundImage: bannerUrl ? `url("${bannerUrl}")` : undefined,
                }}
              />
              <Box direction="Column" gap="200" style={{ padding: config.space.S300 }}>
                <Box alignItems="End" justifyContent="SpaceBetween" gap="200">
                  <div
                    style={{
                      marginTop: `-${toRem(36)}`,
                      borderRadius: '50%',
                      outline: `${config.borderWidth.B600} solid ${color.Surface.Container}`,
                    }}
                  >
                    {avatar('400')}
                  </div>
                  <UserBadges userId={userId} />
                </Box>
                <Box direction="Column">
                  <Text size="H5" truncate>
                    {displayName}
                  </Text>
                  <Text size="T200" priority="300" truncate>
                    {userId}
                  </Text>
                </Box>
                {status && (
                  <Text size="T300" style={{ overflowWrap: 'anywhere' }}>
                    {status}
                  </Text>
                )}
                <UserBio userId={userId} maxLines={4} />
              </Box>
              <Line variant="Surface" size="300" />
              <Box direction="Column" style={{ padding: config.space.S100 }}>
                {STATUS_OPTIONS.map((option) => (
                  <MenuItem
                    key={option.value}
                    size="300"
                    radii="300"
                    aria-pressed={chosen === option.value}
                    style={
                      option.hint
                        ? {
                            height: 'auto',
                            paddingTop: config.space.S100,
                            paddingBottom: config.space.S100,
                          }
                        : undefined
                    }
                    before={
                      <StatusIcon
                        status={option.value === 'invisible' ? 'offline' : option.value}
                        size={12}
                        decorative
                      />
                    }
                    after={chosen === option.value && <Icon size="100" src={Icons.Check} />}
                    onClick={run(() => setChosen(option.value))}
                  >
                    <Box direction="Column" grow="Yes">
                      <Text size="T300">{option.label}</Text>
                      {option.hint && (
                        <Text size="T200" priority="300">
                          {option.hint}
                        </Text>
                      )}
                    </Box>
                  </MenuItem>
                ))}
              </Box>
              <Line variant="Surface" size="300" />
              <Box direction="Column" style={{ padding: config.space.S100 }}>
                <MenuItem
                  size="300"
                  radii="300"
                  before={<Icon size="100" src={Icons.Smile} />}
                  onClick={run(() => setEditingStatus(true))}
                >
                  <Text size="T300">{status ? 'Edit Status' : 'Set a Status'}</Text>
                </MenuItem>
                <MenuItem
                  size="300"
                  radii="300"
                  before={<Icon size="100" src={Icons.Pencil} />}
                  onClick={run(() => openSettings(SettingsPages.AccountPage))}
                >
                  <Text size="T300">Edit Profile</Text>
                </MenuItem>
                <MenuItem
                  size="300"
                  radii="300"
                  before={<Icon size="100" src={Icons.Link} />}
                  onClick={run(() => copyToClipboard(userId))}
                >
                  <Text size="T300">Copy User ID</Text>
                </MenuItem>
              </Box>
            </Menu>
          </FocusTrap>
        }
      >
        <button
          type="button"
          ref={meRef}
          className={css.Me}
          onClick={openMenu}
          aria-haspopup="menu"
          aria-expanded={!!menuCords}
          aria-label="Your profile and status"
        >
          <span className={css.AvatarWrap}>
            {avatar('300')}
            <span className={css.OnlineDot}>
              <StatusIcon status={activity} size={12} />
            </span>
          </span>
          <Box className={css.MeText} direction="Column">
            <Text size="T300" truncate style={{ fontWeight: 600 }}>
              {displayName}
            </Text>
            <span className={css.Swap}>
              <Text className={css.SwapFront} size="T200" priority="300" truncate>
                {status ?? STATUS_LABELS[chosen]}
              </Text>
              <Text className={css.SwapBack} size="T200" priority="300" truncate aria-hidden>
                {getMxIdLocalPart(userId)}
              </Text>
            </span>
          </Box>
        </button>
      </PopOut>
      <TooltipProvider
        position="Top"
        tooltip={
          <Tooltip>
            <Text size="T200">User Settings</Text>
          </Tooltip>
        }
      >
        {(triggerRef) => (
          <IconButton
            ref={triggerRef}
            size="300"
            radii="300"
            variant="SurfaceVariant"
            fill="None"
            aria-label="User Settings"
            onClick={() => openSettings(SettingsPages.GeneralPage)}
          >
            <Icon size="200" src={Icons.Setting} />
          </IconButton>
        )}
      </TooltipProvider>
      {editingStatus && (
        <StatusDialog userId={userId} requestClose={() => setEditingStatus(false)} />
      )}
    </Box>
  );
}

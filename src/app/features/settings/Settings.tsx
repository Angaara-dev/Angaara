import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Avatar,
  Box,
  Button,
  config,
  Icon,
  IconButton,
  Icons,
  IconSrc,
  MenuItem,
  Overlay,
  OverlayBackdrop,
  OverlayCenter,
  Text,
} from 'folds';
import FocusTrap from 'focus-trap-react';
import { General } from './general';
import { PageNav, PageNavContent, PageNavHeader, PageRoot } from '../../components/page';
import { ScreenSize, usePhone, useScreenSizeContext } from '../../hooks/useScreenSize';
import { Account } from './account';
import { useUserProfile } from '../../hooks/useUserProfile';
import { useMatrixClient } from '../../hooks/useMatrixClient';
import { getMxIdLocalPart, mxcUrlToHttp } from '../../utils/matrix';
import { useMediaAuthentication } from '../../hooks/useMediaAuthentication';
import { UserAvatar } from '../../components/user-avatar';
import { nameInitials } from '../../utils/common';
import { Notifications } from './notifications';
import { Devices } from './devices';
import { EmojisStickers } from './emojis-stickers';
import { DeveloperTools } from './developer-tools';
import { About } from './about';
import { UseStateProvider } from '../../components/UseStateProvider';
import { stopPropagation } from '../../utils/keyboard';
import { LogoutDialog } from '../../components/LogoutDialog';
import { MobileSettingsHome } from './MobileSettingsHome';

const SUB_PAGE = 'angaaraSettingsPage';

export enum SettingsPages {
  GeneralPage,
  AccountPage,
  NotificationPage,
  DevicesPage,
  EmojisStickersPage,
  DeveloperToolsPage,
  AboutPage,
}

type SettingsMenuItem = {
  page: SettingsPages;
  name: string;
  icon: IconSrc;
};

const useSettingsMenuItems = (): SettingsMenuItem[] =>
  useMemo(
    () => [
      {
        page: SettingsPages.GeneralPage,
        name: 'General',
        icon: Icons.Setting,
      },
      {
        page: SettingsPages.AccountPage,
        name: 'Account',
        icon: Icons.User,
      },
      {
        page: SettingsPages.NotificationPage,
        name: 'Notifications',
        icon: Icons.Bell,
      },
      {
        page: SettingsPages.DevicesPage,
        name: 'Devices',
        icon: Icons.Monitor,
      },
      {
        page: SettingsPages.EmojisStickersPage,
        name: 'Emojis & Stickers',
        icon: Icons.Smile,
      },
      {
        page: SettingsPages.DeveloperToolsPage,
        name: 'Developer Tools',
        icon: Icons.Terminal,
      },
      {
        page: SettingsPages.AboutPage,
        name: 'About',
        icon: Icons.Info,
      },
    ],
    []
  );

type SettingsProps = {
  initialPage?: SettingsPages;
  requestClose: () => void;
};
export function Settings({ initialPage, requestClose }: SettingsProps) {
  const mx = useMatrixClient();
  const useAuthentication = useMediaAuthentication();
  const userId = mx.getUserId()!;
  const profile = useUserProfile(userId);
  const displayName = profile.displayName ?? getMxIdLocalPart(userId) ?? userId;
  const avatarUrl = profile.avatarUrl
    ? mxcUrlToHttp(mx, profile.avatarUrl, useAuthentication, 96, 96, 'crop') ?? undefined
    : undefined;

  const screenSize = useScreenSizeContext();
  const phone = usePhone();
  const [activePage, setActivePage] = useState<SettingsPages | undefined>(() => {
    if (initialPage) return initialPage;
    return screenSize === ScreenSize.Mobile ? undefined : SettingsPages.GeneralPage;
  });
  const menuItems = useSettingsMenuItems();

  // Phones: opening a page adds its own history entry (on the user's tap), so the back button
  // returns to the list. Entries added without a tap get skipped by Chrome's back button.
  const openPage = (page: SettingsPages) => {
    if (phone && activePage === undefined) {
      window.history.pushState({ ...window.history.state, [SUB_PAGE]: true }, '');
    }
    setActivePage(page);
  };
  const backToList = useCallback(() => {
    if (phone && window.history.state?.[SUB_PAGE]) window.history.back();
    else setActivePage(undefined);
  }, [phone]);
  // Opened straight onto a page (like Support us): give it an entry too, while the tap still
  // counts, so back steps to the list and then Home. Waits a tick for the panel's own entry.
  useEffect(() => {
    if (!phone || !initialPage) return undefined;
    const timer = window.setTimeout(() => {
      if (!window.history.state?.[SUB_PAGE]) {
        window.history.pushState({ ...window.history.state, [SUB_PAGE]: true }, '');
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [phone, initialPage]);
  useEffect(() => {
    if (!phone) return undefined;
    const onPop = () => {
      if (!window.history.state?.[SUB_PAGE]) setActivePage(undefined);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [phone]);

  const handlePageRequestClose = () => {
    if (screenSize === ScreenSize.Mobile) {
      backToList();
      return;
    }
    requestClose();
  };

  useEffect(() => {
    if (!phone || activePage === undefined) return undefined;
    const onKey = (evt: KeyboardEvent) => {
      // Leave it alone while a dialog is open on top of settings.
      if (
        evt.key !== 'Escape' ||
        (document.getElementById('portalContainer')?.childElementCount ?? 0) > 1
      )
        return;
      evt.stopImmediatePropagation();
      evt.preventDefault();
      backToList();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [phone, activePage, backToList]);

  if (phone && activePage === undefined) {
    const pick = (...pages: SettingsPages[]) =>
      pages.flatMap((page) => menuItems.filter((item) => item.page === page));
    return (
      <MobileSettingsHome
        groups={[
          {
            title: 'Account Settings',
            items: pick(
              SettingsPages.AccountPage,
              SettingsPages.NotificationPage,
              SettingsPages.DevicesPage
            ),
          },
          {
            title: 'App Settings',
            items: pick(SettingsPages.GeneralPage, SettingsPages.EmojisStickersPage),
          },
          {
            title: 'More',
            items: pick(SettingsPages.DeveloperToolsPage, SettingsPages.AboutPage),
          },
        ]}
        profilePage={SettingsPages.AccountPage}
        onSelect={openPage}
        requestClose={requestClose}
      />
    );
  }

  return (
    <PageRoot
      nav={
        screenSize === ScreenSize.Mobile && activePage !== undefined ? undefined : (
          <PageNav size="300">
            <PageNavHeader outlined={false}>
              <Box grow="Yes" gap="200">
                <Avatar size="200" radii="300">
                  <UserAvatar
                    userId={userId}
                    src={avatarUrl}
                    renderFallback={() => <Text size="H6">{nameInitials(displayName)}</Text>}
                  />
                </Avatar>
                <Text size="H4" truncate>
                  Settings
                </Text>
              </Box>
              <Box shrink="No">
                {screenSize === ScreenSize.Mobile && (
                  <IconButton onClick={requestClose} variant="Background">
                    <Icon src={Icons.Cross} />
                  </IconButton>
                )}
              </Box>
            </PageNavHeader>
            <Box grow="Yes" direction="Column">
              <PageNavContent>
                <div style={{ flexGrow: 1 }}>
                  {menuItems.map((item) => (
                    <MenuItem
                      key={item.name}
                      variant="Background"
                      radii="400"
                      aria-pressed={activePage === item.page}
                      before={<Icon src={item.icon} size="100" filled={activePage === item.page} />}
                      onClick={() => setActivePage(item.page)}
                    >
                      <Text
                        style={{
                          fontWeight: activePage === item.page ? config.fontWeight.W600 : undefined,
                        }}
                        size="T300"
                        truncate
                      >
                        {item.name}
                      </Text>
                    </MenuItem>
                  ))}
                </div>
              </PageNavContent>
              <Box style={{ padding: config.space.S200 }} shrink="No" direction="Column">
                <UseStateProvider initial={false}>
                  {(logout, setLogout) => (
                    <>
                      <Button
                        size="300"
                        variant="Critical"
                        fill="None"
                        radii="Pill"
                        before={<Icon src={Icons.Power} size="100" />}
                        onClick={() => setLogout(true)}
                      >
                        <Text size="B400">Logout</Text>
                      </Button>
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
                    </>
                  )}
                </UseStateProvider>
              </Box>
            </Box>
          </PageNav>
        )
      }
    >
      {activePage === SettingsPages.GeneralPage && (
        <General requestClose={handlePageRequestClose} />
      )}
      {activePage === SettingsPages.AccountPage && (
        <Account requestClose={handlePageRequestClose} />
      )}
      {activePage === SettingsPages.NotificationPage && (
        <Notifications requestClose={handlePageRequestClose} />
      )}
      {activePage === SettingsPages.DevicesPage && (
        <Devices requestClose={handlePageRequestClose} />
      )}
      {activePage === SettingsPages.EmojisStickersPage && (
        <EmojisStickers requestClose={handlePageRequestClose} />
      )}
      {activePage === SettingsPages.DeveloperToolsPage && (
        <DeveloperTools requestClose={handlePageRequestClose} />
      )}
      {activePage === SettingsPages.AboutPage && <About requestClose={handlePageRequestClose} />}
    </PageRoot>
  );
}

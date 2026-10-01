import {
  Box,
  Button,
  config,
  Dialog,
  Icon,
  IconButton,
  Icons,
  Menu,
  MenuItem,
  PopOut,
  RectCords,
  Text,
} from 'folds';
import { HttpApiEvent, HttpApiEventHandlerMap, MatrixClient } from 'matrix-js-sdk';
import FocusTrap from 'focus-trap-react';
import React, { MouseEventHandler, ReactNode, useCallback, useEffect, useState } from 'react';
import {
  clearCacheAndReload,
  clearLoginData,
  initClient,
  logoutClient,
  startClient,
} from '../../../client/initMatrix';
import { SplashLoading, SplashScreen } from '../../components/splash-screen';
import { ServerConfigsLoader } from '../../components/ServerConfigsLoader';
import { CapabilitiesProvider } from '../../hooks/useCapabilities';
import { MediaConfigProvider } from '../../hooks/useMediaConfig';
import { MatrixClientProvider } from '../../hooks/useMatrixClient';
import { SpecVersions } from './SpecVersions';
import { Welcome } from '../../features/welcome/Welcome';
import { LinkContextMenu } from '../../features/link-check/LinkCheck';
import { RemovedNotice } from '../../features/removed-notice/RemovedNotice';
import { AsyncStatus, useAsyncCallback } from '../../hooks/useAsyncCallback';
import { useSyncState } from '../../hooks/useSyncState';
import { stopPropagation } from '../../utils/keyboard';
import { SyncStatus } from './SyncStatus';
import { isOutdated } from '../../features/app-update/outdated';
import { AuthMetadataProvider } from '../../hooks/useAuthMetadata';
import { getFallbackSession } from '../../state/sessions';
import { AppLockedError, forgetStoreKeys } from '../../../client/storeKey';
import { AppLockScreen } from './AppLockScreen';
import { AutoDiscovery } from './AutoDiscovery';

function ClientRootLoading() {
  return (
    <SplashScreen>
      <SplashLoading signedIn />
    </SplashScreen>
  );
}

function ClientRootOptions({ mx }: { mx?: MatrixClient }) {
  const [menuAnchor, setMenuAnchor] = useState<RectCords>();

  const handleToggle: MouseEventHandler<HTMLButtonElement> = (evt) => {
    const cords = evt.currentTarget.getBoundingClientRect();
    setMenuAnchor((currentState) => {
      if (currentState) return undefined;
      return cords;
    });
  };

  return (
    <IconButton
      style={{
        position: 'absolute',
        top: config.space.S100,
        right: config.space.S100,
      }}
      variant="Background"
      fill="None"
      onClick={handleToggle}
    >
      <Icon size="200" src={Icons.VerticalDots} />
      <PopOut
        anchor={menuAnchor}
        position="Bottom"
        align="End"
        offset={6}
        content={
          <FocusTrap
            focusTrapOptions={{
              initialFocus: false,
              returnFocusOnDeactivate: false,
              onDeactivate: () => setMenuAnchor(undefined),
              clickOutsideDeactivates: true,
              isKeyForward: (evt: KeyboardEvent) => evt.key === 'ArrowDown',
              isKeyBackward: (evt: KeyboardEvent) => evt.key === 'ArrowUp',
              escapeDeactivates: stopPropagation,
            }}
          >
            <Menu>
              <Box direction="Column" gap="100" style={{ padding: config.space.S100 }}>
                {mx && (
                  <MenuItem onClick={() => clearCacheAndReload(mx)} size="300" radii="300">
                    <Text as="span" size="T300" truncate>
                      Clear Cache and Reload
                    </Text>
                  </MenuItem>
                )}
                <MenuItem
                  onClick={() => {
                    if (mx) {
                      logoutClient(mx);
                      return;
                    }
                    clearLoginData();
                  }}
                  size="300"
                  radii="300"
                  variant="Critical"
                  fill="None"
                >
                  <Text as="span" size="T300" truncate>
                    Logout
                  </Text>
                </MenuItem>
              </Box>
            </Menu>
          </FocusTrap>
        }
      />
    </IconButton>
  );
}

const useLogoutListener = (mx?: MatrixClient) => {
  useEffect(() => {
    const handleLogout: HttpApiEventHandlerMap[HttpApiEvent.SessionLoggedOut] = async () => {
      mx?.stopClient();
      await mx?.clearStores();
      await forgetStoreKeys();
      window.localStorage.clear();
      window.location.reload();
    };

    mx?.on(HttpApiEvent.SessionLoggedOut, handleLogout);
    return () => {
      mx?.removeListener(HttpApiEvent.SessionLoggedOut, handleLogout);
    };
  }, [mx]);
};

type ClientRootProps = {
  children: ReactNode;
};
export function ClientRoot({ children }: ClientRootProps) {
  const [loading, setLoading] = useState(true);
  const { baseUrl, userId } = getFallbackSession() ?? {};

  const [loadState, loadMatrix] = useAsyncCallback<MatrixClient, Error, []>(
    useCallback(() => {
      const session = getFallbackSession();
      if (!session) {
        throw new Error('No session Found!');
      }
      return initClient(session);
    }, [])
  );
  const mx = loadState.status === AsyncStatus.Success ? loadState.data : undefined;
  const locked =
    loadState.status === AsyncStatus.Error && loadState.error instanceof AppLockedError;
  const [startState, startMatrix] = useAsyncCallback<void, Error, [MatrixClient]>(
    useCallback((m) => startClient(m), [])
  );

  useLogoutListener(mx);

  useEffect(() => {
    if (loadState.status === AsyncStatus.Idle) {
      loadMatrix();
    }
  }, [loadState, loadMatrix]);

  useEffect(() => {
    if (mx && !mx.clientRunning) {
      startMatrix(mx);
    }
  }, [mx, startMatrix]);

  useSyncState(
    mx,
    useCallback((state) => {
      if (state === 'PREPARED') {
        setLoading(false);
      }
    }, [])
  );

  const outdated =
    (loadState.status === AsyncStatus.Error && isOutdated(loadState.error)) ||
    (startState.status === AsyncStatus.Error && isOutdated(startState.error));

  return (
    <AutoDiscovery userId={userId!} baseUrl={baseUrl!}>
      <SpecVersions baseUrl={baseUrl!}>
        {mx && <SyncStatus mx={mx} />}
        {loading && !locked && <ClientRootOptions mx={mx} />}
        {locked && <AppLockScreen onUnlocked={loadMatrix} />}
        {((loadState.status === AsyncStatus.Error && !locked) ||
          startState.status === AsyncStatus.Error) && (
          <SplashScreen>
            <Box
              direction="Column"
              grow="Yes"
              alignItems="Center"
              justifyContent="Center"
              gap="400"
            >
              <Dialog>
                <Box direction="Column" gap="400" style={{ padding: config.space.S400 }}>
                  {outdated && (
                    <Text>Angaara just got updated. Reload to get the new version.</Text>
                  )}
                  {!outdated && loadState.status === AsyncStatus.Error && (
                    <Text>{`Failed to load. ${loadState.error.message}`}</Text>
                  )}
                  {!outdated && startState.status === AsyncStatus.Error && (
                    <Text>{`Failed to start. ${startState.error.message}`}</Text>
                  )}
                  {/* Retrying can't fetch files an update removed; only a reload gets the new ones. */}
                  <Button
                    variant={outdated ? 'Primary' : 'Critical'}
                    onClick={() => {
                      if (outdated) window.location.reload();
                      else if (mx) startMatrix(mx);
                      else loadMatrix();
                    }}
                  >
                    <Text as="span" size="B400">
                      {outdated ? 'Reload' : 'Retry'}
                    </Text>
                  </Button>
                </Box>
              </Dialog>
            </Box>
          </SplashScreen>
        )}
        {loading || !mx ? (
          !locked && <ClientRootLoading />
        ) : (
          <MatrixClientProvider value={mx}>
            <ServerConfigsLoader>
              {(serverConfigs) => (
                <CapabilitiesProvider value={serverConfigs.capabilities ?? {}}>
                  <MediaConfigProvider value={serverConfigs.mediaConfig ?? {}}>
                    <AuthMetadataProvider value={serverConfigs.authMetadata}>
                      {children}
                      <Welcome />
                      <RemovedNotice />
                      <LinkContextMenu />
                    </AuthMetadataProvider>
                  </MediaConfigProvider>
                </CapabilitiesProvider>
              )}
            </ServerConfigsLoader>
          </MatrixClientProvider>
        )}
      </SpecVersions>
    </AutoDiscovery>
  );
}

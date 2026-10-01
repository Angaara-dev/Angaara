import React, { useCallback, useEffect } from 'react';
import { Box, Scroll, Spinner, Text, color, toRem } from 'folds';
import {
  Outlet,
  generatePath,
  matchPath,
  useLocation,
  useNavigate,
  useParams,
} from 'react-router-dom';
import classNames from 'classnames';

import { AuthFooter } from './AuthFooter';
import { AuthHeading } from './AuthHeading';
import * as css from './styles.css';
import {
  clientAllowedServer,
  clientDefaultServer,
  useClientConfig,
} from '../../hooks/useClientConfig';
import { AsyncStatus, useAsyncCallback } from '../../hooks/useAsyncCallback';
import { LOGIN_PATH, REGISTER_PATH, RESET_PASSWORD_PATH } from '../paths';
import { AngaaraLogo } from '../../components/angaara-logo';
import { ServerPicker } from './ServerPicker';
import { AutoDiscoveryAction, autoDiscovery } from '../../cs-api';
import { SpecVersionsLoader } from '../../components/SpecVersionsLoader';
import { SpecVersionsProvider } from '../../hooks/useSpecVersions';
import { AutoDiscoveryInfoProvider } from '../../hooks/useAutoDiscoveryInfo';
import { AuthFlowsLoader } from '../../components/AuthFlowsLoader';
import { AuthFlowsProvider } from '../../hooks/useAuthFlows';
import { AuthServerProvider } from '../../hooks/useAuthServer';
import { tryDecodeURIComponent } from '../../utils/dom';
import { BRAND_NAME, HOMEPAGE_URL } from '../../brand';

const currentAuthPath = (pathname: string): string => {
  if (matchPath(LOGIN_PATH, pathname)) {
    return LOGIN_PATH;
  }
  if (matchPath(RESET_PASSWORD_PATH, pathname)) {
    return RESET_PASSWORD_PATH;
  }
  if (matchPath(REGISTER_PATH, pathname)) {
    return REGISTER_PATH;
  }
  return LOGIN_PATH;
};

const HEADINGS: Record<string, { title: string; subtitle?: string }> = {
  [LOGIN_PATH]: {
    title: 'Welcome back!',
    subtitle: 'Good to see you again. Your chats are right where you left them.',
  },
  [REGISTER_PATH]: {
    title: 'Create an account',
    subtitle: "It's free, and your DMs are encrypted from the very first message.",
  },
  [RESET_PASSWORD_PATH]: { title: 'Reset your password' },
};

// Fixed positions so the embers don't jump around on re-render.
const EMBERS = Array.from({ length: 28 }, (_, i) => ({
  left: `${(i * 47 + 7) % 100}%`,
  size: 4 + ((i * 7) % 6),
  duration: 7 + ((i * 3) % 6),
  delay: -((i * 1.7) % 12),
  drift: `${((i * 29) % 80) - 40}px`,
}));

function Embers() {
  return (
    <div className={css.Embers} aria-hidden>
      {EMBERS.map((ember) => (
        <span
          key={ember.left}
          className={css.Ember}
          style={
            {
              left: ember.left,
              width: toRem(ember.size),
              height: toRem(ember.size),
              animationDuration: `${ember.duration}s`,
              animationDelay: `${ember.delay}s`,
              '--drift': ember.drift,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}

function AuthSide() {
  return (
    <Box className={css.AuthSide} direction="Column" justifyContent="Center" gap="400">
      <AngaaraLogo size={84} animated />
      <Text as="h3" className={css.AuthSideTitle}>
        Your chats, locked tight
      </Text>
      <ul className={css.AuthSideList}>
        <li>End-to-end encrypted DMs</li>
        <li>Verify every device</li>
        <li>Check files before you open them</li>
        <li>Open source, no trackers</li>
      </ul>
      <Text as="a" size="T300" className={css.AuthSideLink} href={HOMEPAGE_URL} target="_blank">
        {`What's ${BRAND_NAME}?`}
      </Text>
    </Box>
  );
}

function AuthLayoutLoading({ message }: { message: string }) {
  return (
    <Box justifyContent="Center" alignItems="Center" gap="200">
      <Spinner size="100" variant="Secondary" />
      <Text align="Center" size="T300">
        {message}
      </Text>
    </Box>
  );
}

function AuthLayoutError({ message }: { message: string }) {
  return (
    <Box justifyContent="Center" alignItems="Center" gap="200">
      <Text align="Center" style={{ color: color.Critical.Main }} size="T300">
        {message}
      </Text>
    </Box>
  );
}

export function AuthLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { server: urlEncodedServer } = useParams();

  const clientConfig = useClientConfig();

  const defaultServer = clientDefaultServer(clientConfig);
  let server: string = urlEncodedServer ? tryDecodeURIComponent(urlEncodedServer) : defaultServer;

  if (!clientAllowedServer(clientConfig, server)) {
    server = defaultServer;
  }

  const [discoveryState, discoverServer] = useAsyncCallback(
    useCallback(async (serverName: string) => {
      const response = await autoDiscovery(fetch, serverName);
      return {
        serverName,
        response,
      };
    }, [])
  );

  useEffect(() => {
    if (server) discoverServer(server);
  }, [discoverServer, server]);

  // if server is mismatches with path server, update path
  useEffect(() => {
    if (!urlEncodedServer || tryDecodeURIComponent(urlEncodedServer) !== server) {
      navigate(
        generatePath(currentAuthPath(location.pathname), {
          server: encodeURIComponent(server),
        }),
        { replace: true }
      );
    }
  }, [urlEncodedServer, navigate, location, server]);

  const selectServer = useCallback(
    (newServer: string) => {
      if (newServer === server) {
        if (discoveryState.status === AsyncStatus.Loading) return;
        discoverServer(server);
        return;
      }
      navigate(
        generatePath(currentAuthPath(location.pathname), { server: encodeURIComponent(newServer) })
      );
    },
    [navigate, location, discoveryState, server, discoverServer]
  );

  const [autoDiscoveryError, autoDiscoveryInfo] =
    discoveryState.status === AsyncStatus.Success ? discoveryState.data.response : [];

  return (
    <Scroll variant="Background" visibility="Hover" size="300" hideTrack>
      <Box
        className={classNames(css.AuthLayout)}
        direction="Column"
        alignItems="Center"
        justifyContent="SpaceBetween"
        gap="400"
      >
        <Embers />
        <Box as="header" className={css.AuthTopBar}>
          <a className={css.AuthBrand} href={HOMEPAGE_URL} target="_blank" rel="noreferrer">
            <AngaaraLogo size={36} />
            <Text as="span" className={css.AuthTitle}>
              {BRAND_NAME}
            </Text>
          </a>
        </Box>
        <Box className={css.AuthMain} justifyContent="Center" alignItems="Center">
          <div className={css.AuthCard}>
            <Box className={css.AuthCardContent} direction="Column">
              <AuthHeading {...HEADINGS[currentAuthPath(location.pathname)]} />
              <Box direction="Column" gap="100">
                <Text as="label" size="L400" priority="300">
                  Homeserver
                </Text>
                <ServerPicker
                  server={server}
                  serverList={clientConfig.homeserverList ?? []}
                  allowCustomServer={clientConfig.allowCustomHomeservers}
                  onServerChange={selectServer}
                />
              </Box>
              {discoveryState.status === AsyncStatus.Loading && (
                <AuthLayoutLoading message="Looking for homeserver..." />
              )}
              {discoveryState.status === AsyncStatus.Error && (
                <AuthLayoutError message="Failed to find homeserver." />
              )}
              {autoDiscoveryError?.action === AutoDiscoveryAction.FAIL_PROMPT && (
                <AuthLayoutError
                  message={`Failed to connect. Homeserver configuration found with ${autoDiscoveryError.host} appears unusable.`}
                />
              )}
              {autoDiscoveryError?.action === AutoDiscoveryAction.FAIL_ERROR && (
                <AuthLayoutError message="Failed to connect. Homeserver configuration base_url appears invalid." />
              )}
              {discoveryState.status === AsyncStatus.Success && autoDiscoveryInfo && (
                <AuthServerProvider value={discoveryState.data.serverName}>
                  <AutoDiscoveryInfoProvider value={autoDiscoveryInfo}>
                    <SpecVersionsLoader
                      baseUrl={autoDiscoveryInfo['m.homeserver'].base_url}
                      fallback={() => (
                        <AuthLayoutLoading
                          message={`Connecting to ${autoDiscoveryInfo['m.homeserver'].base_url}`}
                        />
                      )}
                      error={() => (
                        <AuthLayoutError message="Failed to connect. Either homeserver is unavailable at this moment or does not exist." />
                      )}
                    >
                      {(specVersions) => (
                        <SpecVersionsProvider value={specVersions}>
                          <AuthFlowsLoader
                            fallback={() => (
                              <AuthLayoutLoading message="Loading authentication flow..." />
                            )}
                            error={() => (
                              <AuthLayoutError message="Failed to get authentication flow information." />
                            )}
                          >
                            {(authFlows) => (
                              <AuthFlowsProvider value={authFlows}>
                                <Outlet />
                              </AuthFlowsProvider>
                            )}
                          </AuthFlowsLoader>
                        </SpecVersionsProvider>
                      )}
                    </SpecVersionsLoader>
                  </AutoDiscoveryInfoProvider>
                </AuthServerProvider>
              )}
            </Box>
            <AuthSide />
          </div>
        </Box>
        <AuthFooter />
      </Box>
    </Scroll>
  );
}

import React from 'react';
import { Provider as JotaiProvider } from 'jotai';
import { OverlayContainerProvider, PopOutContainerProvider, TooltipContainerProvider } from 'folds';
import { RouterProvider } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';

import { ErrorBoundary } from 'react-error-boundary';
import { ClientConfigLoader } from '../components/ClientConfigLoader';
import { ClientConfigProvider } from '../hooks/useClientConfig';
import { setGrantedSpaces } from '../hooks/useSpaceLevel';
import { ConfigConfigError, ConfigConfigLoading } from './ConfigConfig';
import { FeatureCheck } from './FeatureCheck';
import { createRouter } from './Router';
import { ScreenSizeProvider, useScreenSize } from '../hooks/useScreenSize';
import { useCompositionEndTracking } from '../hooks/useComposingCheck';
import { CrashScreen } from '../features/app-reports/CrashScreen';

const queryClient = new QueryClient();

function App() {
  const screenSize = useScreenSize();
  useCompositionEndTracking();

  const portalContainer = document.getElementById('portalContainer') ?? undefined;

  return (
    // Catches crashes outside the router too, like while loading the app's config.
    <ErrorBoundary fallbackRender={({ error }) => <CrashScreen error={error} />}>
      <TooltipContainerProvider value={portalContainer}>
        <PopOutContainerProvider value={portalContainer}>
          <OverlayContainerProvider value={portalContainer}>
            <ScreenSizeProvider value={screenSize}>
              <FeatureCheck>
                <ClientConfigLoader
                  fallback={() => <ConfigConfigLoading />}
                  error={(err, retry, ignore) => (
                    <ConfigConfigError error={err} retry={retry} ignore={ignore} />
                  )}
                >
                  {(clientConfig) => {
                    setGrantedSpaces(
                      clientConfig.fullAccessSpaces,
                      Object.keys(clientConfig.badges ?? {}).filter((id) =>
                        clientConfig.badges?.[id].includes('founder')
                      )
                    );
                    return (
                      <ClientConfigProvider value={clientConfig}>
                        <QueryClientProvider client={queryClient}>
                          <JotaiProvider>
                            <RouterProvider router={createRouter(clientConfig, screenSize)} />
                          </JotaiProvider>
                          <ReactQueryDevtools initialIsOpen={false} />
                        </QueryClientProvider>
                      </ClientConfigProvider>
                    );
                  }}
                </ClientConfigLoader>
              </FeatureCheck>
            </ScreenSizeProvider>
          </OverlayContainerProvider>
        </PopOutContainerProvider>
      </TooltipContainerProvider>
    </ErrorBoundary>
  );
}

export default App;

import React, { ReactNode, useEffect, useLayoutEffect } from 'react';
import { configClass, varsClass } from 'folds';
import { useAtomValue } from 'jotai';
import { EmberTheme, ThemeContextProvider, ThemeKind, useActiveTheme } from '../hooks/useTheme';
import { applyAccent, applyServerTheme, usableAsAccent } from '../utils/accent';
import { useSetting } from '../state/hooks/settings';
import { settingsAtom } from '../state/settings';
import { serverThemeHiddenAtom, spaceThemeAtom } from '../state/spaceAccent';

export function UnAuthRouteThemeManager() {
  useEffect(() => {
    document.body.className = '';
    document.body.classList.add(configClass, varsClass, ...EmberTheme.classNames);
    document.documentElement.style.colorScheme = 'dark';
    // Ends the orange loading screen from index.html.
    document.body.removeAttribute('data-loading');
  }, []);

  return null;
}

export function AuthRouteThemeManager({ children }: { children: ReactNode }) {
  const activeTheme = useActiveTheme();
  const [monochromeMode] = useSetting(settingsAtom, 'monochromeMode');
  const [userAccent] = useSetting(settingsAtom, 'accentColor');
  const serverTheme = useAtomValue(spaceThemeAtom);
  const spaceTheme = useAtomValue(serverThemeHiddenAtom) ? undefined : serverTheme;

  useLayoutEffect(() => {
    document.body.className = '';
    document.body.classList.add(configClass, varsClass);

    document.body.classList.add(...activeTheme.classNames);
    document.body.removeAttribute('data-loading');
    // Native scrollbars and form controls follow the theme.
    document.documentElement.style.colorScheme =
      activeTheme.kind === ThemeKind.Dark ? 'dark' : 'light';

    if (monochromeMode) {
      document.body.style.filter = 'grayscale(1)';
    } else {
      document.body.style.filter = '';
    }
  }, [activeTheme, monochromeMode]);

  // Layout effect so a server's colours land in the same frame the server opens.
  useLayoutEffect(() => {
    const dark = activeTheme.kind === ThemeKind.Dark;
    const serverAccent = spaceTheme?.accent;
    applyAccent(
      serverAccent && usableAsAccent(serverAccent, dark) ? serverAccent : userAccent,
      dark
    );
    applyServerTheme(spaceTheme, dark);
  }, [spaceTheme, userAccent, activeTheme]);

  return <ThemeContextProvider value={activeTheme}>{children}</ThemeContextProvider>;
}

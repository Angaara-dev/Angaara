import React, { CSSProperties, ReactNode, useLayoutEffect, useMemo } from 'react';
import { atom, useAtom, useSetAtom } from 'jotai';
import { color } from 'folds';
import { Settings, SettingsPages } from './Settings';
import { Modal500 } from '../../components/Modal500';
import { useMatrixClient } from '../../hooks/useMatrixClient';
import { ThemeKind, useTheme } from '../../hooks/useTheme';
import {
  profileThemeBackground,
  profileThemeVars,
  useProfileTheme,
} from '../../hooks/useProfileTheme';
import { themeWashVars, varName } from '../../utils/accent';
import { serverThemeHiddenAtom } from '../../state/spaceAccent';

export const userSettingsPageAtom = atom<SettingsPages | undefined>(undefined);

// Your settings wear your own profile colours (or none), never the server's.
export function SettingsModal({
  requestClose,
  children,
}: {
  requestClose: () => void;
  children: ReactNode;
}) {
  const mx = useMatrixClient();
  const profileTheme = useProfileTheme(mx.getSafeUserId());
  const dark = useTheme().kind === ThemeKind.Dark;
  const hideServerTheme = useSetAtom(serverThemeHiddenAtom);

  useLayoutEffect(() => {
    hideServerTheme(true);
    return () => hideServerTheme(false);
  }, [hideServerTheme]);

  const themeStyle = useMemo((): CSSProperties => {
    if (!profileTheme) return {};
    const bg = varName(color.Background.Container);
    return {
      ...profileThemeVars(profileTheme, dark),
      ...themeWashVars(dark),
      ...(bg && { [bg]: 'transparent' }),
      backgroundImage: profileThemeBackground(profileTheme, dark),
    };
  }, [profileTheme, dark]);

  return (
    <Modal500 requestClose={requestClose} themeStyle={themeStyle}>
      {children}
    </Modal500>
  );
}

export function UserSettingsRenderer() {
  const [page, setPage] = useAtom(userSettingsPageAtom);
  if (page === undefined) return null;

  const close = () => setPage(undefined);
  return (
    <SettingsModal requestClose={close}>
      <Settings initialPage={page} requestClose={close} />
    </SettingsModal>
  );
}

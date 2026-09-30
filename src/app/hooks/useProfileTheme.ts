import { CSSProperties } from 'react';
import { color } from 'folds';
import { hexToHsl, hslToHex, isHexColor, themeStop, varName } from '../utils/accent';
import { readProfileString, useExtendedProfile } from './useUserBanner';
import { useXpPerk } from './useXpPerk';

// Two profile colours, stored as "#top,#bottom" on the extended profile.
export const PROFILE_THEME_KEY = 'io.angaara.profile_theme';

export type ProfileTheme = { top: string; bottom: string };

export const parseProfileTheme = (value: string | undefined): ProfileTheme | undefined => {
  const [top, bottom] = value?.split(',').map((c) => c.trim()) ?? [];
  return top && bottom && isHexColor(top) && isHexColor(bottom) ? { top, bottom } : undefined;
};

export const profileThemeBackground = (theme: ProfileTheme, dark: boolean) =>
  `linear-gradient(180deg, ${themeStop(theme.top, dark)}, ${themeStop(theme.bottom, dark)})`;

const CONTAINER_KEYS = ['Container', 'ContainerHover', 'ContainerActive', 'ContainerLine'];

// Buttons and chips inside a profile take its colours: the accent drives buttons,
// and cards and chips turn into see-through washes over the gradient.
export const profileThemeVars = (theme: ProfileTheme, dark: boolean): CSSProperties => {
  const vars: Record<string, string> = {};
  const { h, s } = hexToHsl(theme.bottom);
  const button = (l: number) => hslToHex({ h, s: Math.min(s, 70), l: dark ? l : l + 18 });
  const primary: [string, string][] = [
    [color.Primary.Main, button(32)],
    [color.Primary.MainHover, button(37)],
    [color.Primary.MainActive, button(42)],
    [color.Primary.MainLine, button(50)],
    [color.Primary.OnMain, '#FFFFFF'],
  ];
  primary.forEach(([token, value]) => {
    const name = varName(token);
    if (name) vars[name] = value;
  });
  const wash = dark
    ? [
        'rgba(0, 0, 0, 0.24)',
        'rgba(0, 0, 0, 0.32)',
        'rgba(0, 0, 0, 0.4)',
        'rgba(255, 255, 255, 0.08)',
      ]
    : [
        'rgba(255, 255, 255, 0.4)',
        'rgba(255, 255, 255, 0.5)',
        'rgba(255, 255, 255, 0.6)',
        'rgba(0, 0, 0, 0.08)',
      ];
  [color.Background, color.Surface, color.SurfaceVariant, color.Secondary].forEach((group) =>
    CONTAINER_KEYS.forEach((key, i) => {
      const name = varName((group as unknown as Record<string, string>)[key]);
      if (name) vars[name] = wash[i];
    })
  );
  return vars as CSSProperties;
};

export const useProfileTheme = (userId: string, enabled = true): ProfileTheme | undefined => {
  const theme = parseProfileTheme(
    readProfileString(useExtendedProfile(userId, enabled), [PROFILE_THEME_KEY])
  );
  const unlocked = useXpPerk(userId, 'profileTheme', enabled && !!theme);
  return unlocked ? theme : undefined;
};

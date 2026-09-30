import { useQuery } from '@tanstack/react-query';
import { MatrixClient } from 'matrix-js-sdk';
import { useMatrixClient } from './useMatrixClient';
import { useMediaAuthentication } from './useMediaAuthentication';
import { mxcUrlToHttp } from '../utils/matrix';
import { useStillImage } from './useStillImage';
import { useXpPerk } from './useXpPerk';

// MSC4427 profile banners: write the unstable key until m.banner_url is in the spec.
export const BANNER_PROFILE_KEY = 'chat.commet.profile_banner';
// Old keys from before the rename, still read so existing profiles keep working.
export const LEGACY_BANNER_KEYS: string[] = ['io.hearth.banner'];
const BANNER_READ_KEYS = ['m.banner_url', BANNER_PROFILE_KEY, ...LEGACY_BANNER_KEYS];

export const MAX_BANNER_BYTES = 8 * 1000 * 1000;
export const MAX_BANNER_LABEL = '8 MB';

export const extendedProfileQueryKey = (userId: string) => ['extended-profile', userId];

export const useExtendedProfileSupport = (): boolean | undefined => {
  const mx = useMatrixClient();
  const { data } = useQuery({
    queryKey: ['extended-profile-support'],
    queryFn: () => mx.doesServerSupportExtendedProfiles(),
    staleTime: Infinity,
  });
  return data;
};

export const extendedProfileQuery = (mx: MatrixClient, userId: string) => ({
  queryKey: extendedProfileQueryKey(userId),
  queryFn: async (): Promise<Record<string, unknown>> => {
    try {
      return await mx.getExtendedProfile(userId);
    } catch {
      return {};
    }
  },
  staleTime: 5 * 60 * 1000,
});

export const useExtendedProfile = (
  userId: string,
  enabled = true
): Record<string, unknown> | undefined => {
  const mx = useMatrixClient();
  const { data } = useQuery({ ...extendedProfileQuery(mx, userId), enabled });
  return data;
};

export const PANEL_BG_PROFILE_KEY = 'io.angaara.panel_background';
export const LEGACY_PANEL_BG_KEYS: string[] = ['io.hearth.panel_background'];

const useProfileMxc = (userId: string, keys: string[], enabled = true): string | undefined => {
  const profile = useExtendedProfile(userId, enabled);
  return keys
    .map((key) => profile?.[key])
    .find((v): v is string => typeof v === 'string' && v.startsWith('mxc://'));
};

export const useUserBannerMxc = (userId: string): string | undefined =>
  useProfileMxc(userId, BANNER_READ_KEYS);

// Full-size URL, not a thumbnail, so animated GIFs keep playing.
export const useProfileImageUrl = (
  userId: string,
  keys: string[],
  enabled = true
): string | undefined => {
  const mx = useMatrixClient();
  const useAuthentication = useMediaAuthentication();
  const mxc = useProfileMxc(userId, keys, enabled);
  return mxc ? mxcUrlToHttp(mx, mxc, useAuthentication) ?? undefined : undefined;
};

// GIFs stay on their first frame until the owner earns the XP for them.
// XP is only looked up for people who actually have an image, not for every member row.
export const useUserBannerUrl = (userId: string): string | undefined => {
  const url = useProfileImageUrl(userId, BANNER_READ_KEYS);
  return useStillImage(url, !useXpPerk(userId, 'bannerGif', !!url));
};

// Pass enabled=false to skip fetching, e.g. for member rows that scrolled past.
export const useUserPanelBgUrl = (userId: string, enabled = true): string | undefined => {
  const url = useProfileImageUrl(userId, [PANEL_BG_PROFILE_KEY, ...LEGACY_PANEL_BG_KEYS], enabled);
  return useStillImage(url, !useXpPerk(userId, 'panelGif', enabled && !!url));
};

// First non-empty string among the keys, so a new key wins over its legacy one.
export const readProfileString = (
  profile: Record<string, unknown> | undefined,
  keys: string[]
): string | undefined =>
  keys
    .map((key) => profile?.[key])
    .find((v): v is string => typeof v === 'string' && v.trim() !== '');

export const BANNER_COLOR_PROFILE_KEY = 'io.angaara.banner_color';
export const useUserBannerColor = (userId: string): string | undefined => {
  const value = useExtendedProfile(userId)?.[BANNER_COLOR_PROFILE_KEY];
  return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value) ? value : undefined;
};

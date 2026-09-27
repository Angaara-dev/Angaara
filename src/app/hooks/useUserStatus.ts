import { readProfileString, useExtendedProfile } from './useUserBanner';

// Profile field rather than presence status_msg: many servers (matrix.org included) turn presence off.
export const STATUS_PROFILE_KEY = 'io.angaara.status';
export const LEGACY_STATUS_KEY = 'io.hearth.status';
export const MAX_STATUS_LENGTH = 100;

export const useUserStatus = (userId: string, enabled = true): string | undefined => {
  const value = readProfileString(useExtendedProfile(userId, enabled), [
    STATUS_PROFILE_KEY,
    LEGACY_STATUS_KEY,
  ]);
  return value?.trim().slice(0, MAX_STATUS_LENGTH);
};

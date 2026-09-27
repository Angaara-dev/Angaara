import { readProfileString, useExtendedProfile } from './useUserBanner';

// Stored as an extended profile field, so it follows the account to every client and device.
export const BIO_PROFILE_KEY = 'io.angaara.bio';
export const LEGACY_BIO_KEY = 'io.hearth.bio';
export const MAX_BIO_LENGTH = 190;

export const useUserBio = (userId: string): string | undefined => {
  const value = readProfileString(useExtendedProfile(userId), [BIO_PROFILE_KEY, LEGACY_BIO_KEY]);
  return value?.slice(0, MAX_BIO_LENGTH);
};

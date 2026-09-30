import {
  parseProfileEffect,
  PROFILE_EFFECT_KEY,
  ProfileEffectId,
} from '../components/profile-effect';
import { readProfileString, useExtendedProfile } from './useUserBanner';
import { useXpPerk } from './useXpPerk';

export const useProfileEffect = (userId: string, enabled = true): ProfileEffectId | undefined => {
  const effect = parseProfileEffect(
    readProfileString(useExtendedProfile(userId, enabled), [PROFILE_EFFECT_KEY])
  );
  const unlocked = useXpPerk(userId, 'profileEffect', enabled && !!effect);
  return unlocked ? effect : undefined;
};

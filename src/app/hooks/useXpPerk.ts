import { XP_PERKS, XpPerk } from '../../client/xp';
import { useUserBadges } from './useUserBadges';
import { useUserXp } from './useUserXp';

// Founders have every perk, and deployments without the XP counter lock nothing.
export const useXpPerk = (userId: string, perk: XpPerk, enabled = true): boolean => {
  const status = useUserXp(userId, enabled);
  const founder = useUserBadges(userId).some((badge) => badge.id === 'founder');
  if (founder || status === null) return true;
  return (status?.xp ?? 0) >= XP_PERKS[perk];
};

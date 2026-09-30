import { XP_PERKS, XpPerk } from '../../client/xp';
import { useUserBadges } from './useUserBadges';
import { useUserXp } from './useUserXp';

// Founders and the team have every perk, and deployments without the XP counter lock nothing.
export const useXpPerk = (userId: string, perk: XpPerk, enabled = true): boolean => {
  const status = useUserXp(userId, enabled);
  const allAccess = useUserBadges(userId).some((b) => b.id === 'founder' || b.id === 'team');
  if (allAccess || status === null) return true;
  return (status?.xp ?? 0) >= XP_PERKS[perk];
};

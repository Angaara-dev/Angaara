import { IconSrc, Icons } from 'folds';
import { useClientConfig } from './useClientConfig';
import { useUserXp } from './useUserXp';
import { EARLY_EMBER_MEMBERS } from '../../client/xp';

export type BadgeId = 'founder' | 'developer' | 'staff' | 'supporter' | 'earlyEmber';
export type BadgeInfo = { id: BadgeId; label: string; icon: IconSrc; color: string };

export const BADGES: Record<BadgeId, BadgeInfo> = {
  founder: { id: 'founder', label: 'Angaara Founder', icon: Icons.Star, color: '#FF8A3D' },
  developer: { id: 'developer', label: 'Developer', icon: Icons.Terminal, color: '#5EC8FF' },
  staff: { id: 'staff', label: 'Staff', icon: Icons.ShieldUser, color: '#A78BFA' },
  supporter: { id: 'supporter', label: 'Supporter', icon: Icons.Heart, color: '#F472B6' },
  earlyEmber: { id: 'earlyEmber', label: 'Early Ember', icon: Icons.Sun, color: '#FF6B3D' },
};

// Granted in config.json by whoever deploys the client, so users can't award themselves badges.
// Early Ember and Angaara-account Supporter come from the Worker, so only full profiles ask.
export const useUserBadges = (userId: string, withXp = false): BadgeInfo[] => {
  const ids = useClientConfig().badges?.[userId] ?? [];
  const xp = useUserXp(userId, withXp);
  const badges = ids.filter((id): id is BadgeId => id in BADGES).map((id) => BADGES[id]);
  if (withXp && xp?.supporter && !ids.includes('supporter')) badges.push(BADGES.supporter);
  if (withXp && xp?.member && xp.member <= EARLY_EMBER_MEMBERS) badges.push(BADGES.earlyEmber);
  return badges;
};

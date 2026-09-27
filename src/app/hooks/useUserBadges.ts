import { IconSrc, Icons } from 'folds';
import { useClientConfig } from './useClientConfig';

export type BadgeId = 'founder' | 'developer' | 'staff' | 'supporter';
export type BadgeInfo = { id: BadgeId; label: string; icon: IconSrc; color: string };

export const BADGES: Record<BadgeId, BadgeInfo> = {
  founder: { id: 'founder', label: 'Angaara Founder', icon: Icons.Star, color: '#FF8A3D' },
  developer: { id: 'developer', label: 'Developer', icon: Icons.Terminal, color: '#5EC8FF' },
  staff: { id: 'staff', label: 'Staff', icon: Icons.ShieldUser, color: '#A78BFA' },
  supporter: { id: 'supporter', label: 'Supporter', icon: Icons.Heart, color: '#F472B6' },
};

// Granted in config.json by whoever deploys the client, so users can't award themselves badges.
export const useUserBadges = (userId: string): BadgeInfo[] => {
  const ids = useClientConfig().badges?.[userId] ?? [];
  return ids.filter((id): id is BadgeId => id in BADGES).map((id) => BADGES[id]);
};

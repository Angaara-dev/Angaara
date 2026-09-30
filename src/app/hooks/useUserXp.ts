import { useQuery } from '@tanstack/react-query';
import { XpStatus, xpApi } from '../../client/xp';

export const userXpQueryKey = (userId: string) => ['user-xp', userId];

// Anyone's XP, read from the Worker; null when the counter isn't set up on this deployment.
// Other failures stay undefined, so a broken counter keeps perks locked.
export const useUserXp = (userId: string, enabled = true): XpStatus | null | undefined => {
  const { data } = useQuery({
    queryKey: userXpQueryKey(userId),
    queryFn: async (): Promise<XpStatus | null> => {
      const res = await fetch(xpApi(`user/${encodeURIComponent(userId)}`));
      if (res.status === 501) return null;
      if (!res.ok) throw new Error(`XP lookup failed: ${res.status}`);
      return res.json();
    },
    enabled,
    staleTime: 5 * 60 * 1000,
  });
  return data;
};

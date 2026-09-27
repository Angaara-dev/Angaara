import { useQuery } from '@tanstack/react-query';
import { XpStatus, xpApi } from '../../client/xp';

export const userXpQueryKey = (userId: string) => ['user-xp', userId];

// Anyone's XP, read from the Worker; null when the counter isn't set up on this deployment.
export const useUserXp = (userId: string, enabled = true): XpStatus | null | undefined => {
  const { data } = useQuery({
    queryKey: userXpQueryKey(userId),
    queryFn: async (): Promise<XpStatus | null> => {
      const res = await fetch(xpApi(`user/${encodeURIComponent(userId)}`));
      if (!res.ok) return null;
      return res.json();
    },
    enabled,
    staleTime: 5 * 60 * 1000,
  });
  return data;
};

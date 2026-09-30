import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { PASS_PROFILE_KEY, Perk, PerkPass, verifyPass } from '../../client/perks';
import { useExtendedProfile } from './useUserBanner';
import { BADGES, BadgeInfo } from './useUserBadges';

// Perks from the signed pass in someone's profile. Parked until launch; see docs/PERKS.md.
export const useUserPerks = (userId: string, enabled = true): PerkPass | undefined => {
  const pass = useExtendedProfile(userId, enabled)?.[PASS_PROFILE_KEY];
  const { data } = useQuery({
    queryKey: ['perk-pass', userId, pass],
    queryFn: async () => (await verifyPass(pass, userId)) ?? null,
    enabled: enabled && typeof pass === 'string',
    staleTime: 60 * 60 * 1000,
  });
  return data ?? undefined;
};

export const useHasPerk = (userId: string, perk: Perk, enabled = true): boolean =>
  !!useUserPerks(userId, enabled)?.perks.includes(perk);

export const usePerkBadges = (userId: string): BadgeInfo[] =>
  useHasPerk(userId, 'supporter') ? [BADGES.supporter] : [];

export const useStillImageUrl = (src: string | undefined, animate: boolean): string | undefined => {
  const [still, setStill] = useState<string>();

  useEffect(() => {
    setStill(undefined);
    if (!src || animate) return undefined;
    let cancelled = false;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      if (cancelled) return;
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        canvas.getContext('2d')?.drawImage(img, 0, 0);
        setStill(canvas.toDataURL('image/png'));
      } catch {
        // Tainted canvas: show nothing rather than the animation.
      }
    };
    img.src = src;
    return () => {
      cancelled = true;
    };
  }, [src, animate]);

  return animate ? src : still;
};

import colorMXID from '../../../util/colorMXID';

// Behind profiles without a banner: a darker, muted take on the user's colour.
export const bannerFallback = (userId: string) =>
  `color-mix(in srgb, ${colorMXID(userId)} 35%, #18181b)`;

import colorMXID from '../../../util/colorMXID';

export const bannerFallback = (userId: string) =>
  `color-mix(in srgb, ${colorMXID(userId)} 35%, #18181b)`;

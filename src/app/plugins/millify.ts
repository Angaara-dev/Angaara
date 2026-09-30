import millifyPlugin from 'millify';
import { MillifyOptions } from 'millify/dist/options';

export const millify = (count: number, options?: Partial<MillifyOptions>): string => {
  // Below 1000 the result is the number itself, and millify is costly per call (unread badges).
  if (!options && Number.isInteger(count) && Math.abs(count) < 1000) return String(count);
  return millifyPlugin(count, {
    precision: 1,
    locales: [],
    ...options,
  });
};

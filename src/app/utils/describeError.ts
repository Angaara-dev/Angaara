import { MatrixError } from 'matrix-js-sdk';
import { bytesToSize } from './common';

const seconds = (ms: number) => Math.max(1, Math.ceil(ms / 1000));

type HomeserverError = {
  errcode?: string;
  httpStatus?: number;
  data?: { error?: string };
  getRetryAfterMs: () => number | null;
};

// Turns homeserver and network failures into a message people can act on.
export const describeError = (err: unknown, fallback: string): string => {
  if (err instanceof MatrixError) {
    const hs = err as HomeserverError;
    const status = hs.httpStatus;
    switch (hs.errcode) {
      case 'M_TOO_LARGE':
        return 'That file is too big for your homeserver. Try a smaller one.';
      case 'M_LIMIT_EXCEEDED': {
        const wait = hs.getRetryAfterMs();
        return wait
          ? `Too many changes at once. Try again in ${seconds(wait)} seconds.`
          : 'Too many changes at once. Wait a moment and try again.';
      }
      case 'M_PROFILE_TOO_LARGE':
        return 'Your profile is full on your homeserver. Remove something, like an old banner, and try again.';
      case 'M_KEY_TOO_LARGE':
        return 'That is too long for your homeserver.';
      case 'M_FORBIDDEN':
        return hs.data?.error
          ? `Your homeserver refused: ${hs.data.error}`
          : "Your homeserver doesn't allow that.";
      case 'M_UNRECOGNIZED':
        return "Your homeserver doesn't support this yet.";
      default:
    }
    if (status === 413) return 'That file is too big for your homeserver. Try a smaller one.';
    if (status && status >= 500) return 'Your homeserver is having trouble. Try again in a bit.';
    return hs.data?.error ? `${fallback} (${hs.data.error})` : fallback;
  }
  if (err instanceof Error && err.name === 'ConnectionError') {
    return "Couldn't reach your homeserver. Check your connection and try again.";
  }
  if (err instanceof TypeError && /fetch|network/i.test(err.message)) {
    return "Couldn't reach your homeserver. Check your connection and try again.";
  }
  return err instanceof Error && err.message ? `${fallback} (${err.message})` : fallback;
};

export const tooBigMessage = (what: string, size: number, limit: number) =>
  `${what} is ${bytesToSize(size)}, and the limit is ${bytesToSize(
    limit
  )}. Try a shorter or smaller one.`;

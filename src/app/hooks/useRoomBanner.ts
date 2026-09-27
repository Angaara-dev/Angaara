import { Room } from 'matrix-js-sdk';
import { useMatrixClient } from './useMatrixClient';
import { useMediaAuthentication } from './useMediaAuthentication';
import { useStateEvent } from './useStateEvent';
import { StateEvent } from '../../types/matrix/room';
import { mxcUrlToHttp } from '../utils/matrix';

// Angaara-only state event, so other clients ignore it. Empty content means no banner.
export const useRoomBannerMxc = (room: Room): string | undefined => {
  const current = useStateEvent(room, StateEvent.AngaaraRoomBanner);
  const legacy = useStateEvent(room, StateEvent.LegacyRoomBanner);
  // The new event wins even when empty, so clearing the banner hides the old one too.
  const url = (current ?? legacy)?.getContent()?.url;
  return typeof url === 'string' && url.startsWith('mxc://') ? url : undefined;
};

// Full-size URL, not a thumbnail, so animated GIFs keep playing.
export const useRoomBannerUrl = (room: Room): string | undefined => {
  const mx = useMatrixClient();
  const useAuthentication = useMediaAuthentication();
  const mxc = useRoomBannerMxc(room);
  return mxc ? mxcUrlToHttp(mx, mxc, useAuthentication) ?? undefined : undefined;
};

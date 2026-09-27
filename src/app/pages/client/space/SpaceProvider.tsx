import React, { ReactNode, useLayoutEffect } from 'react';
import { Room } from 'matrix-js-sdk';
import { useSetAtom } from 'jotai';
import { useParams } from 'react-router-dom';
import { useMatrixClient } from '../../../hooks/useMatrixClient';
import { useSpaces } from '../../../state/hooks/roomList';
import { allRoomsAtom } from '../../../state/room-list/roomList';
import { useSelectedSpace } from '../../../hooks/router/useSelectedSpace';
import { SpaceProvider } from '../../../hooks/useSpace';
import { JoinBeforeNavigate } from '../../../features/join-before-navigate';
import { useSearchParamsViaServers } from '../../../hooks/router/useSearchParamsViaServers';
import { useStateEvent } from '../../../hooks/useStateEvent';
import { LEVEL_SERVER_COLORS, useSpaceLevel } from '../../../hooks/useSpaceLevel';
import { spaceThemeAtom } from '../../../state/spaceAccent';
import { isHexColor } from '../../../utils/accent';
import { StateEvent } from '../../../../types/matrix/room';

const hexOrUndefined = (value: unknown) =>
  typeof value === 'string' && isHexColor(value) ? value : undefined;

// Applies a levelled-up space's colours while you're inside it.
function SpaceTheme({ space }: { space: Room }) {
  const setSpaceTheme = useSetAtom(spaceThemeAtom);
  const { level } = useSpaceLevel(space);
  const content = useStateEvent(space, StateEvent.AngaaraSpaceTheme)?.getContent();
  const unlocked = level >= LEVEL_SERVER_COLORS;
  const top = unlocked ? hexOrUndefined(content?.top) : undefined;
  const bottom = unlocked ? hexOrUndefined(content?.bottom) : undefined;
  const accent = unlocked ? hexOrUndefined(content?.accent) : undefined;

  // Before paint, so entering a server never flashes the plain colours first.
  useLayoutEffect(() => {
    setSpaceTheme(top || bottom || accent ? { top, bottom, accent } : undefined);
    return () => setSpaceTheme(undefined);
  }, [top, bottom, accent, setSpaceTheme]);

  return null;
}

type RouteSpaceProviderProps = {
  children: ReactNode;
};
export function RouteSpaceProvider({ children }: RouteSpaceProviderProps) {
  const mx = useMatrixClient();
  const joinedSpaces = useSpaces(mx, allRoomsAtom);

  const { spaceIdOrAlias } = useParams();
  const viaServers = useSearchParamsViaServers();

  const selectedSpaceId = useSelectedSpace();
  const space = mx.getRoom(selectedSpaceId);

  if (!space || !joinedSpaces.includes(space.roomId)) {
    return <JoinBeforeNavigate roomIdOrAlias={spaceIdOrAlias ?? ''} viaServers={viaServers} />;
  }

  return (
    <SpaceProvider key={space.roomId} value={space}>
      <SpaceTheme space={space} />
      {children}
    </SpaceProvider>
  );
}

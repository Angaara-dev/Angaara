import { MatrixClient } from 'matrix-js-sdk';
import { Path } from 'react-router-dom';
import { getCanonicalAliasRoomId } from '../../../utils/matrix';

// False when a remembered room path points at a room that now lives in another section.
export const roomPathStillHere = (mx: MatrixClient, path: Path, rooms: string[]): boolean => {
  const segment = path.pathname.split('/').filter(Boolean)[1];
  if (!segment) return true;
  const idOrAlias = decodeURIComponent(segment);
  if (!idOrAlias.startsWith('!') && !idOrAlias.startsWith('#')) return true;
  const roomId = idOrAlias.startsWith('#') ? getCanonicalAliasRoomId(mx, idOrAlias) : idOrAlias;
  return !!roomId && rooms.includes(roomId);
};

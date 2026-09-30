import { Room } from 'matrix-js-sdk';
import { useMatrixClient } from './useMatrixClient';
import { usePowerLevels } from './usePowerLevels';
import { useRoomCreators } from './useRoomCreators';
import { useRoomPermissions } from './useRoomPermissions';
import { StateEvent } from '../../types/matrix/room';

export const useSettingsAccess = (room: Room) => {
  const me = useMatrixClient().getSafeUserId();
  const permissions = useRoomPermissions(useRoomCreators(room), usePowerLevels(room));
  const roles = permissions.stateEvent(StateEvent.PowerLevelTags, me);
  return {
    roles,
    permissions: roles || permissions.stateEvent(StateEvent.RoomPowerLevels, me),
    emojis: permissions.stateEvent(StateEvent.PoniesRoomEmotes, me),
    automod: permissions.stateEvent(StateEvent.AngaaraAutoMod, me),
  };
};

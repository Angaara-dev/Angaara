import React, { useCallback } from 'react';
import { color, Spinner, Switch, Text } from 'folds';
import { SequenceCard } from '../../../components/sequence-card';
import { SequenceCardStyle } from '../../room-settings/styles.css';
import { SettingTile } from '../../../components/setting-tile';
import { useRoom } from '../../../hooks/useRoom';
import { useMatrixClient } from '../../../hooks/useMatrixClient';
import { useStateEvent } from '../../../hooks/useStateEvent';
import { StateEvent } from '../../../../types/matrix/room';
import { RoomPermissionsAPI } from '../../../hooks/useRoomPermissions';
import { AsyncStatus, useAsyncCallback } from '../../../hooks/useAsyncCallback';

type RoomPrivateReactionsProps = {
  permissions: RoomPermissionsAPI;
};
// Encrypted rooms only: hide reaction emojis from the server.
export function RoomPrivateReactions({ permissions }: RoomPrivateReactionsProps) {
  const mx = useMatrixClient();
  const room = useRoom();
  const encrypted = !!useStateEvent(room, StateEvent.RoomEncryption);
  const enabled =
    useStateEvent(room, StateEvent.AngaaraPrivateReactions)?.getContent()?.enabled === true;
  const canEdit = permissions.stateEvent(StateEvent.AngaaraPrivateReactions, mx.getSafeUserId());

  const [saveState, save] = useAsyncCallback(
    useCallback(
      async (value: boolean) => {
        await mx.sendStateEvent(room.roomId, StateEvent.AngaaraPrivateReactions as any, {
          enabled: value,
        });
      },
      [mx, room.roomId]
    )
  );
  const saving = saveState.status === AsyncStatus.Loading;

  if (!encrypted) return null;

  return (
    <SequenceCard className={SequenceCardStyle} variant="SurfaceVariant" direction="Column">
      <SettingTile
        title="Private Reactions"
        description="Encrypt reactions so the server can't see which emoji was picked. Only people who use Angaara see encrypted reactions."
        after={
          saving ? (
            <Spinner variant="Secondary" />
          ) : (
            <Switch variant="Primary" value={enabled} onChange={save} disabled={!canEdit} />
          )
        }
      >
        {saveState.status === AsyncStatus.Error && (
          <Text style={{ color: color.Critical.Main }} size="T200">
            {(saveState.error as { message?: string }).message}
          </Text>
        )}
      </SettingTile>
    </SequenceCard>
  );
}

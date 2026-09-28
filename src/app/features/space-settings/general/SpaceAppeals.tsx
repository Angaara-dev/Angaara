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
import { MAX_APPEALS } from '../../removed-notice/appeals';

// Lets banned members appeal to a mod of their choice, off until a server turns it on.
export function SpaceAppeals({ permissions }: { permissions: RoomPermissionsAPI }) {
  const mx = useMatrixClient();
  const room = useRoom();
  const enabled = useStateEvent(room, StateEvent.AngaaraBanAppeals)?.getContent()?.enabled === true;
  const canEdit = permissions.stateEvent(StateEvent.AngaaraBanAppeals, mx.getSafeUserId());

  const [saveState, save] = useAsyncCallback(
    useCallback(
      async (value: boolean) => {
        await mx.sendStateEvent(
          room.roomId,
          StateEvent.AngaaraBanAppeals as never,
          {
            enabled: value,
          } as never
        );
      },
      [mx, room.roomId]
    )
  );
  const saving = saveState.status === AsyncStatus.Loading;

  return (
    <SequenceCard className={SequenceCardStyle} variant="SurfaceVariant" direction="Column">
      <SettingTile
        title="Ban Appeals"
        description={`Banned members can send up to ${MAX_APPEALS} appeals, each to one mod they pick. Closed appeals are archived for everyone who can ban.`}
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

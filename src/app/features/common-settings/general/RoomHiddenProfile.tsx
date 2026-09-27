import React, { useCallback } from 'react';
import { color, Spinner, Switch, Text } from 'folds';
import { SequenceCard } from '../../../components/sequence-card';
import { SequenceCardStyle } from '../../room-settings/styles.css';
import { SettingTile } from '../../../components/setting-tile';
import { useRoom } from '../../../hooks/useRoom';
import { useMatrixClient } from '../../../hooks/useMatrixClient';
import { useStateEvent } from '../../../hooks/useStateEvent';
import { useHiddenProfile } from '../../../hooks/useRoomMeta';
import { StateEvent } from '../../../../types/matrix/room';
import { RoomPermissionsAPI } from '../../../hooks/useRoomPermissions';
import { AsyncStatus, useAsyncCallback } from '../../../hooks/useAsyncCallback';
import {
  disableHiddenProfile,
  enableHiddenProfile,
  PUBLIC_ROOM_NAME,
} from '../../../../client/hiddenProfile';

type RoomHiddenProfileProps = {
  permissions: RoomPermissionsAPI;
};
// Encrypted rooms only: keep the name and topic out of the server's reach.
export function RoomHiddenProfile({ permissions }: RoomHiddenProfileProps) {
  const mx = useMatrixClient();
  const room = useRoom();
  const encrypted = !!useStateEvent(room, StateEvent.RoomEncryption);
  const nameEvent = useStateEvent(room, StateEvent.RoomName);
  const topicEvent = useStateEvent(room, StateEvent.RoomTopic);
  const hidden = useHiddenProfile(room);
  const me = mx.getSafeUserId();
  const canEdit =
    permissions.stateEvent(StateEvent.AngaaraHiddenProfile, me) &&
    permissions.stateEvent(StateEvent.RoomName, me) &&
    permissions.stateEvent(StateEvent.RoomTopic, me);

  const [saveState, save] = useAsyncCallback(
    useCallback(
      async (on: boolean) => {
        if (!on) {
          await disableHiddenProfile(mx, room);
          return;
        }
        const name = nameEvent?.getContent()?.name;
        const topic = topicEvent?.getContent()?.topic;
        await enableHiddenProfile(mx, room, {
          name: typeof name === 'string' && name !== PUBLIC_ROOM_NAME ? name : '',
          topic: typeof topic === 'string' ? topic : '',
        });
      },
      [mx, room, nameEvent, topicEvent]
    )
  );
  const saving = saveState.status === AsyncStatus.Loading;

  if (!encrypted || room.isSpaceRoom()) return null;

  let description = `Encrypt this room's name and topic so the server can't read them. Other Matrix apps show "${PUBLIC_ROOM_NAME}". Older names may still sit in the server's history, so turn this on when creating a room for full privacy.`;
  if (hidden && !hidden.profile) {
    description =
      "The name is hidden, but this device can't decrypt it yet. It appears once an admin opens the room in Angaara.";
  }

  return (
    <SequenceCard className={SequenceCardStyle} variant="SurfaceVariant" direction="Column">
      <SettingTile
        title="Hide Name and Topic"
        description={description}
        after={
          saving ? (
            <Spinner variant="Secondary" />
          ) : (
            <Switch
              variant="Primary"
              value={!!hidden}
              onChange={save}
              disabled={!canEdit || (!!hidden && !hidden.profile)}
            />
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

import React, { useCallback } from 'react';
import { Box, color, Spinner, Switch, Text } from 'folds';
import { SequenceCard } from '../../../components/sequence-card';
import { SequenceCardStyle } from '../../room-settings/styles.css';
import { SettingTile } from '../../../components/setting-tile';
import { useRoom } from '../../../hooks/useRoom';
import { useMatrixClient } from '../../../hooks/useMatrixClient';
import { useStateEvent } from '../../../hooks/useStateEvent';
import { StateEvent } from '../../../../types/matrix/room';
import { RoomPermissionsAPI } from '../../../hooks/useRoomPermissions';
import { AsyncStatus, useAsyncCallback } from '../../../hooks/useAsyncCallback';
import {
  readDisabledCommands,
  TOGGLEABLE_COMMANDS,
  useDisabledCommands,
} from '../../../hooks/useDisabledCommands';

type RoomCommandsProps = {
  permissions: RoomPermissionsAPI;
};
export function RoomCommands({ permissions }: RoomCommandsProps) {
  const mx = useMatrixClient();
  const room = useRoom();
  const own = readDisabledCommands(useStateEvent(room, StateEvent.AngaaraDisabledCommands));
  const effective = useDisabledCommands(room);
  const canEdit = permissions.stateEvent(StateEvent.AngaaraDisabledCommands, mx.getSafeUserId());

  const [saveState, save] = useAsyncCallback(
    useCallback(
      async (commands: string[]) => {
        await mx.sendStateEvent(room.roomId, StateEvent.AngaaraDisabledCommands as any, {
          commands,
        });
      },
      [mx, room.roomId]
    )
  );
  const saving = saveState.status === AsyncStatus.Loading;

  const setEnabled = (command: string, enabled: boolean) => {
    const next = new Set(own);
    if (enabled) next.delete(command);
    else next.add(command);
    save(Array.from(next));
  };

  let description = room.isSpaceRoom()
    ? "Turn commands off for everyone in this space's rooms."
    : 'Turn commands off for everyone in this room.';
  if (!canEdit) description = 'Only admins can change which commands are allowed.';

  return (
    <SequenceCard className={SequenceCardStyle} variant="SurfaceVariant" direction="Column">
      <SettingTile
        title="Commands"
        description={`${description} Only Angaara follows this; other Matrix apps ignore it.`}
        after={saving && <Spinner variant="Secondary" />}
      >
        <Box direction="Column" gap="300">
          {TOGGLEABLE_COMMANDS.map(({ command, label }) => {
            const fromSpace = effective.has(command) && !own.has(command);
            return (
              <Box key={command} alignItems="Center" gap="300">
                <Box direction="Column" grow="Yes">
                  <Text size="T300">/{command}</Text>
                  <Text size="T200" priority="300">
                    {fromSpace ? 'Turned off by the space' : label}
                  </Text>
                </Box>
                <Switch
                  value={!effective.has(command)}
                  onChange={(enabled: boolean) => setEnabled(command, enabled)}
                  disabled={!canEdit || fromSpace || saving}
                />
              </Box>
            );
          })}
          {saveState.status === AsyncStatus.Error && (
            <Text style={{ color: color.Critical.Main }} size="T200">
              {(saveState.error as { message?: string }).message}
            </Text>
          )}
        </Box>
      </SettingTile>
    </SequenceCard>
  );
}

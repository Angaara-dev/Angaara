import React, { useCallback } from 'react';
import { Box, Chip, color, Spinner, Text } from 'folds';
import { SequenceCard } from '../../../components/sequence-card';
import { SequenceCardStyle } from '../../room-settings/styles.css';
import { SettingTile } from '../../../components/setting-tile';
import { useRoom } from '../../../hooks/useRoom';
import { useMatrixClient } from '../../../hooks/useMatrixClient';
import { StateEvent } from '../../../../types/matrix/room';
import { RoomPermissionsAPI } from '../../../hooks/useRoomPermissions';
import { AsyncStatus, useAsyncCallback } from '../../../hooks/useAsyncCallback';
import { formatSeconds, SLOWMODE_STEPS, useSlowmode } from '../../automod';

export function RoomSlowmode({ permissions }: { permissions: RoomPermissionsAPI }) {
  const mx = useMatrixClient();
  const room = useRoom();
  const seconds = useSlowmode(room);
  const canEdit = permissions.stateEvent(StateEvent.AngaaraSlowmode, mx.getSafeUserId());

  const [saveState, save] = useAsyncCallback(
    useCallback(
      (next: number) =>
        mx.sendStateEvent(
          room.roomId,
          StateEvent.AngaaraSlowmode as never,
          {
            seconds: next,
          } as never
        ),
      [mx, room.roomId]
    )
  );
  const saving = saveState.status === AsyncStatus.Loading;

  return (
    <SequenceCard className={SequenceCardStyle} variant="SurfaceVariant" direction="Column">
      <SettingTile
        title="Slowmode"
        description="How long people wait between messages. Mods and admins are never slowed down. Angaara follows this; the Angaara Bot enforces it for other apps too."
        after={saving && <Spinner variant="Secondary" />}
      >
        <Box wrap="Wrap" gap="100">
          {SLOWMODE_STEPS.map((step) => (
            <Chip
              key={step}
              variant={step === seconds ? 'Primary' : 'SurfaceVariant'}
              radii="Pill"
              outlined={step !== seconds}
              aria-pressed={step === seconds}
              disabled={!canEdit || saving}
              onClick={() => step !== seconds && save(step)}
            >
              <Text size="T200">{step === 0 ? 'Off' : formatSeconds(step)}</Text>
            </Chip>
          ))}
        </Box>
        {saveState.status === AsyncStatus.Error && (
          <Text style={{ color: color.Critical.Main }} size="T200">
            {(saveState.error as { message?: string }).message}
          </Text>
        )}
      </SettingTile>
    </SequenceCard>
  );
}

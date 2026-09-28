import React, { useCallback } from 'react';
import { Box, color, Icon, IconButton, Icons, Spinner, Switch, Text } from 'folds';
import { SequenceCard } from '../../../components/sequence-card';
import { SequenceCardStyle } from '../../room-settings/styles.css';
import { SettingTile } from '../../../components/setting-tile';
import { useRoom } from '../../../hooks/useRoom';
import { useMatrixClient } from '../../../hooks/useMatrixClient';
import { useStateEvent } from '../../../hooks/useStateEvent';
import { StateEvent } from '../../../../types/matrix/room';
import { RoomPermissionsAPI } from '../../../hooks/useRoomPermissions';
import { AsyncStatus, useAsyncCallback } from '../../../hooks/useAsyncCallback';
import { clampAppeals, MAX_APPEALS_LIMIT, pingBanned } from '../../removed-notice/appeals';

// Lets banned members appeal to a mod of their choice, off until a server turns it on.
export function SpaceAppeals({ permissions }: { permissions: RoomPermissionsAPI }) {
  const mx = useMatrixClient();
  const room = useRoom();
  const content = useStateEvent(room, StateEvent.AngaaraBanAppeals)?.getContent() ?? {};
  const enabled = content.enabled === true;
  const max = clampAppeals(content.max);
  const canEdit = permissions.stateEvent(StateEvent.AngaaraBanAppeals, mx.getSafeUserId());

  const [saveState, save] = useAsyncCallback(
    useCallback(
      async (change: { enabled?: boolean; max?: number }) => {
        const next = { enabled, max, ...change };
        await mx.sendStateEvent(room.roomId, StateEvent.AngaaraBanAppeals as never, next as never);
        // Banned members can't see the change, so their apps get told directly.
        await pingBanned(mx, room, next).catch(() => undefined);
      },
      [mx, room, enabled, max]
    )
  );
  const saving = saveState.status === AsyncStatus.Loading;

  return (
    <SequenceCard className={SequenceCardStyle} variant="SurfaceVariant" direction="Column">
      <SettingTile
        title="Ban Appeals"
        description="Banned members can appeal to one mod they pick. Closed appeals are archived for everyone who can ban."
        after={
          saving ? (
            <Spinner variant="Secondary" />
          ) : (
            <Switch
              variant="Primary"
              value={enabled}
              onChange={(value: boolean) => save({ enabled: value })}
              disabled={!canEdit}
            />
          )
        }
      >
        {enabled && (
          <Box alignItems="Center" gap="200">
            <Text size="T300" style={{ flexGrow: 1 }}>
              Appeals per ban
            </Text>
            <IconButton
              size="300"
              radii="300"
              variant="Secondary"
              aria-label="Fewer appeals"
              disabled={!canEdit || saving || max <= 1}
              onClick={() => save({ max: max - 1 })}
            >
              <Icon size="100" src={Icons.Minus} />
            </IconButton>
            <Text size="H5" style={{ minWidth: '2ch', textAlign: 'center' }}>
              {max}
            </Text>
            <IconButton
              size="300"
              radii="300"
              variant="Secondary"
              aria-label="More appeals"
              disabled={!canEdit || saving || max >= MAX_APPEALS_LIMIT}
              onClick={() => save({ max: max + 1 })}
            >
              <Icon size="100" src={Icons.Plus} />
            </IconButton>
          </Box>
        )}
        {saveState.status === AsyncStatus.Error && (
          <Text style={{ color: color.Critical.Main }} size="T200">
            {(saveState.error as { message?: string }).message}
          </Text>
        )}
      </SettingTile>
    </SequenceCard>
  );
}

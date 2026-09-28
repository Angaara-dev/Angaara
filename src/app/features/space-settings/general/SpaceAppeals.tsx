import React, { useCallback, useEffect, useState } from 'react';
import { Box, Button, color, Icon, IconButton, Icons, Spinner, Switch, Text } from 'folds';
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
  addAppealsBot,
  botInSpace,
  clampAppeals,
  getAppealsBotId,
  MAX_APPEALS_LIMIT,
  pingBanned,
} from '../../removed-notice/appeals';

// Lets banned members appeal to a mod of their choice, off until a server turns it on.
export function SpaceAppeals({ permissions }: { permissions: RoomPermissionsAPI }) {
  const mx = useMatrixClient();
  const room = useRoom();
  const content = useStateEvent(room, StateEvent.AngaaraBanAppeals)?.getContent() ?? {};
  const enabled = content.enabled === true;
  const max = clampAppeals(content.max);
  const canEdit = permissions.stateEvent(StateEvent.AngaaraBanAppeals, mx.getSafeUserId());
  const [botId, setBotId] = useState<string>();
  useEffect(() => {
    getAppealsBotId().then(setBotId);
  }, []);
  // Re-renders the bot's membership after adding it.
  useStateEvent(room, StateEvent.RoomMember, botId);
  const botHere = botInSpace(room, botId);

  const [saveState, save] = useAsyncCallback(
    useCallback(
      async (change: { enabled?: boolean; max?: number }) => {
        const next = { enabled, max, ...change };
        await mx.sendStateEvent(room.roomId, StateEvent.AngaaraBanAppeals as never, next as never);
        // Banned members can't see the change, so their apps get told directly.
        await pingBanned(mx, room, next).catch(() => undefined);
        // The bot reads the setting for banned members; if it can't join, Add Bot shows.
        if (next.enabled) await addAppealsBot(mx, room).catch(() => undefined);
      },
      [mx, room, enabled, max]
    )
  );
  const saving = saveState.status === AsyncStatus.Loading;
  const [botState, addBot] = useAsyncCallback(
    useCallback(() => addAppealsBot(mx, room), [mx, room])
  );
  const addingBot = botState.status === AsyncStatus.Loading;

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
        {enabled && botId && !botHere && !saving && (
          <Box direction="Column" gap="200">
            <Text size="T200" priority="300">
              The Angaara bot isn&apos;t in this server, so banned members might not see these
              settings. It only reads this setting and has no powers.
            </Text>
            {canEdit && (
              <Box>
                <Button
                  size="300"
                  variant="Secondary"
                  fill="Soft"
                  radii="300"
                  disabled={addingBot}
                  onClick={addBot}
                  before={addingBot && <Spinner size="100" variant="Secondary" fill="Soft" />}
                >
                  <Text size="B300">Add Bot</Text>
                </Button>
              </Box>
            )}
          </Box>
        )}
        {botState.status === AsyncStatus.Error && (
          <Text style={{ color: color.Critical.Main }} size="T200">
            {(botState.error as { message?: string }).message}
          </Text>
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

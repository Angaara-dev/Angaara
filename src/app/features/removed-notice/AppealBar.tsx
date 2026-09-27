import React, { useState } from 'react';
import { Box, Button, color, config, Spinner, Text } from 'folds';
import { Room } from 'matrix-js-sdk';
import { useMatrixClient } from '../../hooks/useMatrixClient';
import { useStateEvent } from '../../hooks/useStateEvent';
import { StateEvent } from '../../../types/matrix/room';
import {
  APPEAL_STATE,
  canDecide,
  decideAppeal,
  getAppeal,
  getAppellant,
  MAX_APPEALS,
} from './appeals';

// Sits above the message box in a ban appeal, so mods can unban or deny in one click.
export function AppealBar({ room }: { room: Room }) {
  const mx = useMatrixClient();
  // Re-renders when the mods decide.
  useStateEvent(room, APPEAL_STATE as StateEvent);
  const [busy, setBusy] = useState<'accept' | 'deny'>();
  const [error, setError] = useState<string>();

  const appeal = getAppeal(room);
  const user = getAppellant(room);
  if (!appeal || !user) return null;

  const mine = user === mx.getSafeUserId();
  const name = room.getMember(user)?.name ?? user;
  const decide = async (accept: boolean) => {
    setBusy(accept ? 'accept' : 'deny');
    setError(undefined);
    try {
      await decideAppeal(mx, room, accept);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
    }
    setBusy(undefined);
  };

  let text = `${name} is appealing their ban from ${appeal.space_name} (appeal ${appeal.attempt} of ${MAX_APPEALS}).`;
  if (mine) text = `Your appeal for ${appeal.space_name} is waiting on the mods.`;
  if (appeal.status === 'accepted') text = `Appeal accepted. ${name} has been unbanned.`;
  if (appeal.status === 'denied') text = 'Appeal denied.';
  if (appeal.status === 'closed') text = 'Appeal denied. Appeals for this server are now closed.';
  const decidable = appeal.status === 'open' && !mine && canDecide(mx, appeal);

  return (
    <Box
      direction="Column"
      gap="200"
      style={{
        padding: config.space.S300,
        marginBottom: config.space.S200,
        borderRadius: config.radii.R400,
        background: color.SurfaceVariant.Container,
      }}
    >
      <Text size="T300">{text}</Text>
      {appeal.status === 'open' && !mine && !decidable && (
        <Text size="T200" priority="300">
          You need to be able to ban people in {appeal.space_name} to decide this.
        </Text>
      )}
      {error && (
        <Text size="T200" style={{ color: color.Critical.Main }}>
          <b>{error}</b>
        </Text>
      )}
      {decidable && (
        <Box gap="200">
          <Button
            size="300"
            variant="Success"
            radii="300"
            disabled={!!busy}
            onClick={() => decide(true)}
            before={busy === 'accept' && <Spinner size="100" variant="Success" fill="Solid" />}
          >
            <Text size="B300">Unban</Text>
          </Button>
          <Button
            size="300"
            variant="Critical"
            fill="Soft"
            radii="300"
            disabled={!!busy}
            onClick={() => decide(false)}
            before={busy === 'deny' && <Spinner size="100" variant="Critical" fill="Soft" />}
          >
            <Text size="B300">Deny</Text>
          </Button>
        </Box>
      )}
    </Box>
  );
}

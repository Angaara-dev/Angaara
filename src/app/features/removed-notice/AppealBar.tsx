import React, { useEffect, useState } from 'react';
import { Box, Button, color, config, Spinner, Text } from 'folds';
import { Room } from 'matrix-js-sdk';
import { useMatrixClient } from '../../hooks/useMatrixClient';
import { useStateEvent } from '../../hooks/useStateEvent';
import { StateEvent } from '../../../types/matrix/room';
import {
  APPEAL_STATE,
  canDecide,
  closeAppeal,
  shareArchive,
  decideAppeal,
  getAppeal,
  getAppellant,
  appealMax,
  appealLabel,
} from './appeals';

export function AppealBar({ room }: { room: Room }) {
  const mx = useMatrixClient();
  useStateEvent(room, APPEAL_STATE as StateEvent);
  const [busy, setBusy] = useState<'accept' | 'deny' | 'close'>();
  const [error, setError] = useState<string>();

  const appeal = getAppeal(room);
  const user = getAppellant(room);

  // A withdrawn ticket gets filed for every mod the next time its mod opens it.
  const needsSharing = !!appeal?.archived && !appeal.shared;
  useEffect(() => {
    if (needsSharing) shareArchive(mx, room).catch(() => undefined);
  }, [mx, room, needsSharing]);

  if (!appeal || !user) return null;

  const mine = user === mx.getSafeUserId();
  const name = room.getMember(user)?.name ?? user;
  const open = appeal.status === 'open' && !appeal.archived;
  const mod = !mine && canDecide(mx, appeal);

  const act = async (kind: 'accept' | 'deny' | 'close') => {
    setBusy(kind);
    setError(undefined);
    try {
      if (kind === 'close') await closeAppeal(mx, room);
      else await decideAppeal(mx, room, kind === 'accept');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
    }
    setBusy(undefined);
  };

  const from = appeal.room
    ? `${mx.getRoom(appeal.room)?.name ?? appeal.room_name ?? 'a room'} in ${appeal.space_name}`
    : appeal.space_name;
  let text = `${name} is appealing their ban from ${from} (appeal ${appeal.attempt} of ${appealMax(
    appeal
  )}).`;
  if (mine) text = `Your appeal for ${from}. The mods will reply here.`;
  if (appeal.status === 'accepted') text = `Appeal accepted. ${name} has been unbanned.`;
  if (appeal.status === 'denied') text = 'Appeal denied.';
  if (appeal.status === 'closed') text = 'Appeal denied. Appeals for this server are now closed.';
  if (appeal.status === 'open' && appeal.archived) text = 'This appeal was closed.';

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
      <Box alignItems="Center" gap="200">
        <Box direction="Column" gap="100" grow="Yes">
          <Text size="L400" priority="300">
            {appealLabel(mx, appeal)}
          </Text>
          <Text size="T300">{text}</Text>
        </Box>
        {appeal.archived && (
          <Text size="L400" priority="300">
            Archived
          </Text>
        )}
      </Box>
      {error && (
        <Text size="T200" style={{ color: color.Critical.Main }}>
          <b>{error}</b>
        </Text>
      )}
      {open && (mine || mod) && (
        <Box gap="200" wrap="Wrap">
          {mod && (
            <>
              <Button
                size="300"
                variant="Success"
                radii="300"
                disabled={!!busy}
                onClick={() => act('accept')}
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
                onClick={() => act('deny')}
                before={busy === 'deny' && <Spinner size="100" variant="Critical" fill="Soft" />}
              >
                <Text size="B300">Deny</Text>
              </Button>
            </>
          )}
          <Button
            size="300"
            variant="Secondary"
            fill="Soft"
            radii="300"
            disabled={!!busy}
            onClick={() => act('close')}
            before={busy === 'close' && <Spinner size="100" variant="Secondary" fill="Soft" />}
          >
            <Text size="B300">{mine ? 'Withdraw Appeal' : 'Close & Archive'}</Text>
          </Button>
        </Box>
      )}
    </Box>
  );
}

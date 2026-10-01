import React, { useState } from 'react';
import { Box, Button, color, config, Icon, Icons, Spinner, Text } from 'folds';
import { Room } from 'matrix-js-sdk';
import { useMatrixClient } from '../../hooks/useMatrixClient';
import { useStateEvent } from '../../hooks/useStateEvent';
import { StateEvent } from '../../../types/matrix/room';
import { KeySize } from '../../plugins/call/keySize';

type CallEncryptionProps = {
  room: Room;
  // The key size of the call this device is in, when it's in one here.
  keySize?: KeySize;
  warningOnly?: boolean;
};

// Says plainly whether a call is end-to-end encrypted, and with what.
export function CallEncryption({ room, keySize, warningOnly }: CallEncryptionProps) {
  const mx = useMatrixClient();
  const encrypted = !!useStateEvent(room, StateEvent.RoomEncryption);
  const canEncrypt = room.currentState.maySendStateEvent(
    StateEvent.RoomEncryption,
    mx.getSafeUserId()
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  const encrypt = async () => {
    setBusy(true);
    setError(undefined);
    try {
      await mx.sendStateEvent(
        room.roomId,
        StateEvent.RoomEncryption as never,
        { algorithm: 'm.megolm.v1.aes-sha2' } as never
      );
    } catch {
      setError("Couldn't turn on encryption.");
    }
    setBusy(false);
  };

  if (encrypted) {
    if (warningOnly) return null;
    return (
      <Box alignItems="Center" justifyContent="Center" gap="100">
        <Icon size="50" src={Icons.Lock} style={{ color: color.Success.Main }} />
        <Text size="T200" priority="300">
          End-to-end encrypted{keySize ? ` · AES-${keySize}` : ''}
        </Text>
      </Box>
    );
  }
  return (
    <Box direction="Column" alignItems="Center" gap="100" style={{ padding: config.space.S100 }}>
      <Box alignItems="Center" gap="100">
        <Icon size="50" src={Icons.Warning} style={{ color: color.Warning.Main }} />
        <Text size="T200" style={{ color: color.Warning.Main }}>
          Not end-to-end encrypted. The voice server could listen in.
        </Text>
      </Box>
      {canEncrypt && (
        <Button
          size="300"
          variant="Warning"
          fill="Soft"
          radii="300"
          disabled={busy}
          before={busy ? <Spinner size="100" variant="Warning" /> : undefined}
          onClick={encrypt}
        >
          <Text size="B300">Encrypt this channel (can&apos;t be undone)</Text>
        </Button>
      )}
      {error && (
        <Text size="T200" style={{ color: color.Critical.Main }}>
          {error}
        </Text>
      )}
    </Box>
  );
}

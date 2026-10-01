import { useCallback, useMemo } from 'react';
import { MatrixClient, Room } from 'matrix-js-sdk';
import { useAccountData } from '../../hooks/useAccountData';
import { useStateEventCallback } from '../../hooks/useStateEventCallback';
import { useForceUpdate } from '../../hooks/useForceUpdate';
import { useMatrixClient } from '../../hooks/useMatrixClient';
import { MAX_SOUND_NAME, MAX_SOUNDS, readSounds, Sound, SOUNDBOARD_EVENT } from './types';

export const usePersonalSounds = (): Sound[] => {
  const event = useAccountData(SOUNDBOARD_EVENT);
  return useMemo(() => readSounds(event?.getContent()), [event]);
};

export const useServerSounds = (server?: Room): Sound[] => {
  const mx = useMatrixClient();
  const [updateCount, forceUpdate] = useForceUpdate();
  useStateEventCallback(
    mx,
    useCallback(
      (event) => {
        if (event.getRoomId() === server?.roomId && event.getType() === SOUNDBOARD_EVENT) {
          forceUpdate();
        }
      },
      [server, forceUpdate]
    )
  );
  return useMemo(
    () => readSounds(server?.currentState.getStateEvents(SOUNDBOARD_EVENT, '')?.getContent()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [server, updateCount]
  );
};

export const canEditServerSounds = (mx: MatrixClient, server?: Room): boolean =>
  !!server?.currentState.maySendStateEvent(SOUNDBOARD_EVENT, mx.getSafeUserId());

export const savePersonalSounds = (mx: MatrixClient, sounds: Sound[]) =>
  mx.setAccountData(SOUNDBOARD_EVENT as never, { sounds: sounds.slice(0, MAX_SOUNDS) } as never);

export const saveServerSounds = (mx: MatrixClient, server: Room, sounds: Sound[]) =>
  mx.sendStateEvent(
    server.roomId,
    SOUNDBOARD_EVENT as never,
    { sounds: sounds.slice(0, MAX_SOUNDS) } as never,
    ''
  );

// Uploads a checked sound file and returns its entry, ready to add to a list.
export const uploadSound = async (
  mx: MatrixClient,
  file: File,
  name: string,
  emoji?: string
): Promise<Sound> => {
  const { content_uri: url } = await mx.uploadContent(file, { type: file.type || undefined });
  return {
    id: `s${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    name: name.trim().slice(0, MAX_SOUND_NAME) || 'Sound',
    emoji: emoji?.trim() || undefined,
    url,
  };
};

import { useEffect } from 'react';
import { atom, useSetAtom } from 'jotai';
import { ClientEvent } from 'matrix-js-sdk';
import type { ReceivedToDeviceMessage } from 'matrix-js-sdk/lib/sync-accumulator';
import { useMatrixClient } from '../../hooks/useMatrixClient';
import { useMediaAuthentication } from '../../hooks/useMediaAuthentication';
import { useCallJoined } from '../../hooks/useCallEmbed';
import { useSetting } from '../../state/hooks/settings';
import { settingsAtom } from '../../state/settings';
import { CallEmbed } from '../../plugins/call/CallEmbed';
import { playLocal } from '../../plugins/soundboard/audio';
import { forgetCall, receiveSoundMessage, sayHello } from '../../plugins/soundboard/signal';
import { Sound } from '../../plugins/soundboard/types';

export type SoundShown = { userId: string; sound: Sound; at: number };
// The last sound someone played in your call, for a short note on the call screen.
export const lastSoundAtom = atom<SoundShown | undefined>(undefined);

const PER_PERSON_GAP_MS = 1000;

// Greets the other Angaara apps in the call and plays the sounds they send.
export const useSoundboardReceiver = (embed: CallEmbed) => {
  const mx = useMatrixClient();
  const useAuthentication = useMediaAuthentication();
  const joined = useCallJoined(embed);
  const [volume] = useSetting(settingsAtom, 'soundboardVolume');
  const [muted] = useSetting(settingsAtom, 'soundboardMuted');
  const setLastSound = useSetAtom(lastSoundAtom);

  useEffect(() => {
    if (!joined) return undefined;
    const { room } = embed;
    sayHello(mx, room).catch(() => undefined);
    return () => {
      forgetCall(room.roomId);
    };
  }, [mx, embed, joined]);

  useEffect(() => {
    const lastFrom = new Map<string, number>();
    const onMessage = (payload: ReceivedToDeviceMessage) => {
      const incoming = receiveSoundMessage(mx, payload, joined ? embed.room : undefined);
      if (!incoming) return;
      const now = Date.now();
      if (now - (lastFrom.get(incoming.userId) ?? 0) < PER_PERSON_GAP_MS) return;
      lastFrom.set(incoming.userId, now);
      setLastSound({ userId: incoming.userId, sound: incoming.sound, at: now });
      // Mixed sounds already come through the call audio; deafened means silence.
      if (incoming.mixed || muted || !embed.control.sound) return;
      playLocal(mx, incoming.sound, useAuthentication, volume / 100).catch(() => undefined);
    };
    mx.on(ClientEvent.ReceivedToDeviceMessage, onMessage);
    return () => {
      mx.removeListener(ClientEvent.ReceivedToDeviceMessage, onMessage);
    };
  }, [mx, embed, joined, muted, volume, useAuthentication, setLastSound]);
};

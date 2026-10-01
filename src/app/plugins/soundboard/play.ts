import { MatrixClient } from 'matrix-js-sdk';
import { CallEmbed } from '../call/CallEmbed';
import { loadSoundBytes, playLocal } from './audio';
import { otherAppDevices, sendSoundPlay } from './signal';
import { Sound } from './types';

type CallMix = { ready: () => boolean; play: (bytes: ArrayBuffer) => Promise<boolean> };

// Set up inside the call frame by the build patch in vite.config.js.
const callMix = (embed: CallEmbed): CallMix | undefined => {
  try {
    return (embed.iframe.contentWindow as unknown as { __angaaraMix?: CallMix })?.__angaaraMix;
  } catch {
    return undefined;
  }
};

export const SOUND_COOLDOWN_MS = 1500;
let lastPlayed = 0;

export const soundCoolingDown = () => Date.now() - lastPlayed < SOUND_COOLDOWN_MS;

// Angaara apps play the file themselves; other apps only hear it if it's mixed into your mic.
export const playSoundInCall = async (
  mx: MatrixClient,
  embed: CallEmbed,
  sound: Sound,
  useAuthentication: boolean,
  volume: number
): Promise<void> => {
  if (soundCoolingDown()) return;
  lastPlayed = Date.now();
  const bytes = await loadSoundBytes(mx, sound, useAuthentication);

  let mixed = false;
  const mix = callMix(embed);
  if (otherAppDevices(mx, embed.room).length > 0 && embed.control.microphone && mix?.ready()) {
    mixed = await mix.play(bytes.slice(0)).catch(() => false);
  }
  await Promise.all([
    sendSoundPlay(mx, embed.room, sound, mixed),
    playLocal(mx, sound, useAuthentication, volume),
  ]);
};

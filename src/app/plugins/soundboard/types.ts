// Personal sounds live in account data; a server's sounds in a state event on the server.
export const SOUNDBOARD_EVENT = 'io.angaara.soundboard';

// Encrypted to-device messages between the Angaara apps in a call.
export const SOUND_HELLO_EVENT = 'io.angaara.call.hello';
export const SOUND_PLAY_EVENT = 'io.angaara.sound.play';

export const MAX_SOUND_BYTES = 1024 * 1024;
export const MAX_SOUND_SECONDS = 10;
export const MAX_SOUND_NAME = 24;
export const MAX_SOUNDS = 48;

export type Sound = {
  id: string;
  name: string;
  emoji?: string;
  // An mxc:// file, or unset for a starter pack sound.
  url?: string;
  builtin?: string;
};

export type SoundboardContent = {
  sounds?: Sound[];
};

export const isSound = (s: unknown): s is Sound => {
  if (!s || typeof s !== 'object') return false;
  const { id, name, url, builtin } = s as Record<string, unknown>;
  return (
    typeof id === 'string' &&
    typeof name === 'string' &&
    (typeof url === 'string' ? url.startsWith('mxc://') : typeof builtin === 'string')
  );
};

export const readSounds = (content: SoundboardContent | undefined): Sound[] =>
  Array.isArray(content?.sounds) ? content!.sounds.filter(isSound).slice(0, MAX_SOUNDS) : [];

import { MatrixClient } from 'matrix-js-sdk';
import { mxcUrlToHttp } from '../../utils/matrix';
import { renderBuiltin } from './builtin';
import { MAX_SOUND_BYTES, MAX_SOUND_SECONDS, Sound } from './types';

const bytesCache = new Map<string, Promise<ArrayBuffer>>();

const fetchCapped = async (src: string): Promise<ArrayBuffer> => {
  // The service worker adds auth to media requests.
  const res = await fetch(src);
  if (!res.ok) throw new Error(`Sound download failed (${res.status})`);
  const size = Number(res.headers.get('content-length'));
  if (size > MAX_SOUND_BYTES) throw new Error('Sound file too large');
  const buf = await res.arrayBuffer();
  if (buf.byteLength > MAX_SOUND_BYTES) throw new Error('Sound file too large');
  return buf;
};

// The raw file of a sound, shared by local playback and the call mix.
export const loadSoundBytes = (
  mx: MatrixClient,
  sound: Sound,
  useAuthentication: boolean
): Promise<ArrayBuffer> => {
  const key = sound.url ?? `builtin:${sound.builtin}`;
  let job = bytesCache.get(key);
  if (!job) {
    if (sound.url) {
      const src = mxcUrlToHttp(mx, sound.url, useAuthentication);
      job = src ? fetchCapped(src) : Promise.reject(new Error('Bad sound link'));
    } else {
      job = renderBuiltin(sound.builtin ?? '') ?? Promise.reject(new Error('Unknown sound'));
    }
    job.catch(() => bytesCache.delete(key));
    bytesCache.set(key, job);
  }
  return job;
};

let ctx: AudioContext | undefined;
const audioCtx = () => {
  if (!ctx) ctx = new AudioContext();
  if (ctx.state === 'suspended') ctx.resume().catch(() => undefined);
  return ctx;
};

const decoded = new Map<string, Promise<AudioBuffer>>();

export const decodeSound = (key: string, bytes: ArrayBuffer): Promise<AudioBuffer> => {
  let job = decoded.get(key);
  if (!job) {
    // decodeAudioData detaches its input, so it gets a copy.
    job = audioCtx().decodeAudioData(bytes.slice(0));
    job.catch(() => decoded.delete(key));
    decoded.set(key, job);
  }
  return job;
};

// Plays on this device only, cut off at the length limit; volume is 0 to 1.
export const playLocal = async (
  mx: MatrixClient,
  sound: Sound,
  useAuthentication: boolean,
  volume: number
): Promise<void> => {
  const bytes = await loadSoundBytes(mx, sound, useAuthentication);
  const buffer = await decodeSound(sound.url ?? `builtin:${sound.builtin}`, bytes);
  const ac = audioCtx();
  const src = ac.createBufferSource();
  src.buffer = buffer;
  const gain = ac.createGain();
  gain.gain.value = Math.max(0, Math.min(1, volume));
  src.connect(gain).connect(ac.destination);
  src.start();
  src.stop(ac.currentTime + MAX_SOUND_SECONDS);
};

// Checks an upload before it's added: size, that it decodes, and its length.
export const checkSoundFile = async (file: File): Promise<string | undefined> => {
  if (file.size > MAX_SOUND_BYTES) return 'Sounds can be up to 1 MB.';
  try {
    const buffer = await audioCtx().decodeAudioData(await file.arrayBuffer());
    if (buffer.duration > MAX_SOUND_SECONDS + 0.05) {
      return `Sounds can be up to ${MAX_SOUND_SECONDS} seconds long.`;
    }
  } catch {
    return "That file isn't a sound this browser can play.";
  }
  return undefined;
};

import { trimTrailingSlash } from '../../utils/common';
import { Sound } from './types';

// Starter pack files, served from /sounds and copied there by vite.config.js.
const FILES: Record<string, string> = {
  airhorn: 'airhorn.mp3',
  badumtss: 'ba-dum-tss.mp3',
  ding: 'ding.mp3',
  sadtrombone: 'sad-trombone.mp3',
  boing: 'boing.mp3',
  applause: 'applause.mp3',
  drumroll: 'drumroll.mp3',
  pop: 'pop.mp3',
};

export const BUILTIN_SOUNDS: Sound[] = [
  { id: 'builtin-airhorn', builtin: 'airhorn', name: 'Airhorn', emoji: '📯' },
  { id: 'builtin-badumtss', builtin: 'badumtss', name: 'Ba Dum Tss', emoji: '🥁' },
  { id: 'builtin-ding', builtin: 'ding', name: 'Ding', emoji: '🔔' },
  { id: 'builtin-sadtrombone', builtin: 'sadtrombone', name: 'Sad Trombone', emoji: '🎺' },
  { id: 'builtin-boing', builtin: 'boing', name: 'Boing', emoji: '🦘' },
  { id: 'builtin-applause', builtin: 'applause', name: 'Applause', emoji: '👏' },
  { id: 'builtin-drumroll', builtin: 'drumroll', name: 'Drumroll', emoji: '🪘' },
  { id: 'builtin-pop', builtin: 'pop', name: 'Pop', emoji: '🫧' },
];

export const loadBuiltin = (name: string): Promise<ArrayBuffer> | undefined => {
  const file = FILES[name];
  if (!file) return undefined;
  const url = `${trimTrailingSlash(import.meta.env.BASE_URL)}/sounds/${file}`;
  return fetch(url).then((res) => {
    if (!res.ok) throw new Error(`Starter sound missing (${res.status})`);
    return res.arrayBuffer();
  });
};

import { atom } from 'jotai';

// Theme of the space being viewed: gradient colours, and an accent that wins over the user's own.
export type SpaceTheme = { top?: string; bottom?: string; accent?: string };
export const spaceThemeAtom = atom<SpaceTheme | undefined>(undefined);

// True while your own settings are open, so they show your colours instead of the server's.
export const serverThemeHiddenAtom = atom(false);

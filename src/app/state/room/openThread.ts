import { atom } from 'jotai';

export type OpenThread = {
  roomId: string;
  rootId: string;
};

export const openThreadAtom = atom<OpenThread | undefined>(undefined);

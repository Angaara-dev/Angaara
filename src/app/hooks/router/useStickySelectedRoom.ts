import { useSelectedRoom } from './useSelectedRoom';
import { usePhone } from '../useScreenSize';

const lastRoom = new Map<string, string>();

// Phones: keeps the last opened room highlighted in a list after going back to it,
// until another room in that list is opened. `scope` is the list (a server, Home or DMs).
export const useStickySelectedRoom = (scope: string, otherPageOpen = false): string | undefined => {
  const selected = useSelectedRoom();
  const phone = usePhone();
  if (selected) lastRoom.set(scope, selected);
  if (selected || !phone || otherPageOpen) return selected;
  return lastRoom.get(scope);
};

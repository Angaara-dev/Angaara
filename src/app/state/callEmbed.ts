import { atom } from 'jotai';
import { CallEmbed } from '../plugins/call';

const baseCallEmbedAtom = atom<CallEmbed | undefined>(undefined);

export const callEmbedAtom = atom<CallEmbed | undefined, [CallEmbed | undefined], void>(
  (get) => get(baseCallEmbedAtom),
  (get, set, callEmbed) => {
    const prevCallEmbed = get(baseCallEmbedAtom);
    if (callEmbed === prevCallEmbed) return;

    if (prevCallEmbed) {
      prevCallEmbed.dispose();
    }

    set(baseCallEmbedAtom, callEmbed);
  }
);

export const callChatAtom = atom<boolean>(false);

// The chat or DM whose call fills the panel; otherwise that room shows its chat.
export const callViewRoomAtom = atom<string | undefined>(undefined);

// Set when a call this person started had to drop from AES-256 to AES-128.
export const callKeyNoticeAtom = atom<boolean>(false);

// Who is talking right now in the call this device is in.
export const callSpeakersAtom = atom<Set<string>>(new Set<string>());

// Shown when someone tries to turn on a camera they don't have.
export const noCameraNoticeAtom = atom<boolean>(false);

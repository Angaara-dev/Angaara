import { useEffect, useState } from 'react';
import { CompactEmoji, fromUnicodeToHexcode } from 'emojibase';

export type IEmoji = CompactEmoji & {
  shortcode: string;
};

export enum EmojiGroupId {
  People = 'People',
  Nature = 'Nature',
  Food = 'Food',
  Activity = 'Activity',
  Travel = 'Travel',
  Object = 'Object',
  Symbol = 'Symbol',
  Flag = 'Flag',
}

export type IEmojiGroup = {
  id: EmojiGroupId;
  order: number;
  emojis: IEmoji[];
};

export const getHexcodeForEmoji = fromUnicodeToHexcode;

// The emoji tables are ~850KB, so they load in their own chunk on demand.
type EmojiData = typeof import('./emojiData');
let emojiData: EmojiData | undefined;
let emojiDataPromise: Promise<EmojiData> | undefined;

export const loadEmojiData = (): Promise<EmojiData> => {
  if (!emojiDataPromise) {
    emojiDataPromise = import('./emojiData').then((data) => {
      emojiData = data;
      return data;
    });
  }
  return emojiDataPromise;
};

// For non-React code; undefined until the chunk has loaded.
export const getLoadedEmojiData = (): EmojiData | undefined => emojiData;

export const useEmojiData = (): EmojiData | undefined => {
  const [data, setData] = useState(emojiData);
  useEffect(() => {
    if (!data) loadEmojiData().then(setData);
  }, [data]);
  return data;
};

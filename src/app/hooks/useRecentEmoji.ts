import { useEffect, useState } from 'react';
import { ClientEvent, MatrixClient, MatrixEvent } from 'matrix-js-sdk';
import { getRecentEmojis } from '../plugins/recent-emoji';
import { AccountDataEvent } from '../../types/matrix/accountData';
import { IEmoji, useEmojiData } from '../plugins/emoji';

export const useRecentEmoji = (mx: MatrixClient, limit?: number): IEmoji[] => {
  const emojis = useEmojiData()?.emojis;
  const [recentEmoji, setRecentEmoji] = useState(() => getRecentEmojis(mx, emojis ?? [], limit));

  useEffect(() => {
    setRecentEmoji(getRecentEmojis(mx, emojis ?? [], limit));
    const handleAccountData = (event: MatrixEvent) => {
      if (event.getType() !== AccountDataEvent.ElementRecentEmoji) return;
      setRecentEmoji(getRecentEmojis(mx, emojis ?? [], limit));
    };

    mx.on(ClientEvent.AccountData, handleAccountData);
    return () => {
      mx.removeListener(ClientEvent.AccountData, handleAccountData);
    };
  }, [mx, emojis, limit]);

  return recentEmoji;
};

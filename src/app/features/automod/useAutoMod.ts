import { useCallback, useMemo } from 'react';
import { useAtomValue } from 'jotai';
import { Room } from 'matrix-js-sdk';
import { roomToParentsAtom } from '../../state/room/roomToParents';
import { getAllParents, getStateEvent } from '../../utils/room';
import { StateEvent } from '../../../types/matrix/room';
import { useStateEventCallback } from '../../hooks/useStateEventCallback';
import { useForceUpdate } from '../../hooks/useForceUpdate';
import { useStateEvent } from '../../hooks/useStateEvent';
import { AutoModRules, readAutoMod, readSlowmode } from './automod';

// Nested spaces each add their rules; the nearest one's message wins.
const merge = (all: AutoModRules[]): AutoModRules | undefined => {
  if (all.length === 0) return undefined;
  const list = (key: 'words' | 'links') => {
    const on = all.filter((r) => r[key].on);
    return {
      on: on.length > 0,
      list: on.flatMap((r) => r[key].list),
      message: (on[0] ?? all[0])[key].message,
    };
  };
  return {
    words: list('words'),
    links: list('links'),
    invites: all.find((r) => r.invites.on)?.invites ?? all[0].invites,
    bot: all.some((r) => r.bot),
  };
};

// Rules set on this channel's server (or any space above it). Undefined outside servers.
export const useAutoModRules = (room: Room): AutoModRules | undefined => {
  const roomToParents = useAtomValue(roomToParentsAtom);
  const [updateCount, forceUpdate] = useForceUpdate();

  useStateEventCallback(
    room.client,
    useCallback(
      (event) => {
        if (event.getType() === StateEvent.AngaaraAutoMod) forceUpdate();
      },
      [forceUpdate]
    )
  );

  return useMemo(
    () =>
      merge(
        Array.from(getAllParents(roomToParents, room.roomId)).flatMap((id) => {
          const space = room.client.getRoom(id);
          const event = space && getStateEvent(space, StateEvent.AngaaraAutoMod);
          return event ? [readAutoMod(event.getContent())] : [];
        })
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [room, roomToParents, updateCount]
  );
};

export const useSlowmode = (room: Room): number =>
  readSlowmode(useStateEvent(room, StateEvent.AngaaraSlowmode)?.getContent());

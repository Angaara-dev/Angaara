import { useCallback, useMemo } from 'react';
import { useAtomValue } from 'jotai';
import { Command } from './useCommands';
import { useStateEventCallback } from './useStateEventCallback';
import { useForceUpdate } from './useForceUpdate';
import { roomToParentsAtom } from '../state/room/roomToParents';
import { getAllParents, getStateEvent } from '../utils/room';
import { StateEvent } from '../../types/matrix/room';

// Fun commands a space or room can turn off. Moderation commands already follow power levels.
export const TOGGLEABLE_COMMANDS: { command: Command; label: string }[] = [
  { command: Command.Sha256, label: 'Messages sent as a SHA-256 hash' },
  { command: Command.Shrug, label: 'Adds ¯\\_(ツ)_/¯' },
  { command: Command.TableFlip, label: 'Adds (╯°□°)╯︵ ┻━┻' },
  { command: Command.UnFlip, label: 'Adds ┬─┬ノ( º _ ºノ)' },
  { command: Command.Me, label: 'Action messages' },
  { command: Command.Notice, label: 'Notice messages' },
];
const TOGGLEABLE = new Set<string>(TOGGLEABLE_COMMANDS.map((c) => c.command));

type Room = Parameters<typeof getStateEvent>[0];

export const readDisabledCommands = (event?: { getContent(): unknown }): Set<string> => {
  const list = (event?.getContent() as { commands?: unknown } | undefined)?.commands;
  return new Set(
    Array.isArray(list)
      ? list.filter((c): c is string => typeof c === 'string' && TOGGLEABLE.has(c))
      : []
  );
};

// Commands turned off in this room or any space above it. Only Angaara honours this.
export const useDisabledCommands = (room: Room): Set<string> => {
  const roomToParents = useAtomValue(roomToParentsAtom);
  const [updateCount, forceUpdate] = useForceUpdate();

  useStateEventCallback(
    room.client,
    useCallback(
      (event) => {
        if (event.getType() === StateEvent.AngaaraDisabledCommands) forceUpdate();
      },
      [forceUpdate]
    )
  );

  return useMemo(() => {
    const disabled = new Set<string>();
    [room.roomId, ...getAllParents(roomToParents, room.roomId)].forEach((id) => {
      const target = room.client.getRoom(id);
      if (!target) return;
      readDisabledCommands(getStateEvent(target, StateEvent.AngaaraDisabledCommands)).forEach((c) =>
        disabled.add(c)
      );
    });
    return disabled;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room, roomToParents, updateCount]);
};

import React, { useCallback, useEffect } from 'react';
import { Box, Icon, Icons, Line, Text } from 'folds';
import { useParams } from 'react-router-dom';
import { isKeyHotkey } from 'is-hotkey';
import { useAtomValue } from 'jotai';
import { RoomView } from './RoomView';
import { MembersDrawer } from './MembersDrawer';
import { ScreenSize, useScreenSizeContext } from '../../hooks/useScreenSize';
import { useSetting } from '../../state/hooks/settings';
import { settingsAtom } from '../../state/settings';
import { PowerLevelsContextProvider, usePowerLevels } from '../../hooks/usePowerLevels';
import { useRoom } from '../../hooks/useRoom';
import { useKeyDown } from '../../hooks/useKeyDown';
import { markAsRead } from '../../utils/notifications';
import { useMatrixClient } from '../../hooks/useMatrixClient';
import { useRoomMembers } from '../../hooks/useRoomMembers';
import { CallView } from '../call/CallView';
import { RoomViewHeader } from './RoomViewHeader';
import { callChatAtom } from '../../state/callEmbed';
import { CallChatView } from './CallChatView';
import { CallSplit } from './CallSplit';
import { useCallEmbed } from '../../hooks/useCallEmbed';
import { useCallMembers, useCallSession } from '../../hooks/useCall';
import { openThreadAtom } from '../../state/room/openThread';
import { ThreadDrawer } from './thread';
import { markRoomOpen } from '../../utils/timelineTrim';
import { canDecide, getAppeal, getAppellant } from '../removed-notice/appeals';
import { useHideActivity } from '../../hooks/useActivityStatus';
import { mDirectAtom } from '../../state/mDirectList';
import { canUseStrongKeys, markThisDevice } from '../../plugins/call/keySize';

export function Room() {
  const { eventId } = useParams();
  const room = useRoom();
  const mx = useMatrixClient();

  const callSession = useCallSession(room);
  const callMembers = useCallMembers(callSession);
  const callEmbed = useCallEmbed();

  const [isDrawer] = useSetting(settingsAtom, 'isPeopleDrawer');
  const hideActivity = useHideActivity();
  const screenSize = useScreenSizeContext();
  const powerLevels = usePowerLevels(room);
  const members = useRoomMembers(mx, room.roomId);
  const chat = useAtomValue(callChatAtom);
  const openThread = useAtomValue(openThreadAtom);

  useEffect(() => markRoomOpen(room.roomId), [room.roomId]);

  // Lets the other side know this device can do AES-256 calls, before anyone calls.
  const directs = useAtomValue(mDirectAtom);
  const dm = directs.has(room.roomId);
  useEffect(() => {
    if (dm && canUseStrongKeys(mx, room, dm)) markThisDevice(mx, room).catch(() => undefined);
  }, [mx, room, dm]);

  useKeyDown(
    window,
    useCallback(
      (evt) => {
        if (isKeyHotkey('escape', evt)) {
          markAsRead(mx, room.roomId, hideActivity);
        }
      },
      [mx, room.roomId, hideActivity]
    )
  );

  const anyCall = callEmbed?.roomId === room.roomId || room.isCallRoom() || callMembers.length > 0;
  // Voice channels are all call; a call in a chat sits on top of the chat instead.
  const callView = anyCall && room.isCallRoom();
  const splitCall = anyCall && !room.isCallRoom();
  const threadRootId =
    !callView && openThread && openThread.roomId === room.roomId ? openThread.rootId : undefined;
  const mobileThread = !!threadRootId && screenSize !== ScreenSize.Desktop;

  // Appeal tickets are for the appellant and people who can ban; being in the room isn't enough.
  const appeal = getAppeal(room);
  if (appeal && getAppellant(room) !== mx.getSafeUserId() && !canDecide(mx, appeal)) {
    return (
      <Box grow="Yes" direction="Column" alignItems="Center" justifyContent="Center" gap="300">
        <Icon size="600" src={Icons.Lock} />
        <Text size="H4">You do not have permission to see this room</Text>
      </Box>
    );
  }

  return (
    <PowerLevelsContextProvider value={powerLevels}>
      <Box grow="Yes">
        {callView && (screenSize === ScreenSize.Desktop || !chat) && (
          <Box grow="Yes" direction="Column">
            <RoomViewHeader callView />
            <Box grow="Yes">
              <CallView />
            </Box>
          </Box>
        )}
        {!callView && !mobileThread && (
          <Box grow="Yes" direction="Column">
            <RoomViewHeader />
            {splitCall ? (
              <CallSplit>
                <RoomView eventId={eventId} />
              </CallSplit>
            ) : (
              <Box grow="Yes">
                <RoomView eventId={eventId} />
              </Box>
            )}
          </Box>
        )}

        {callView && chat && (
          <>
            {screenSize === ScreenSize.Desktop && (
              <Line variant="Background" direction="Vertical" size="300" />
            )}
            <CallChatView />
          </>
        )}
        {threadRootId && (
          <>
            {!mobileThread && <Line variant="Background" direction="Vertical" size="300" />}
            <ThreadDrawer
              key={threadRootId}
              room={room}
              rootId={threadRootId}
              mobile={mobileThread}
            />
          </>
        )}
        {!callView && !threadRootId && screenSize === ScreenSize.Desktop && isDrawer && (
          <>
            <Line variant="Background" direction="Vertical" size="300" />
            <MembersDrawer key={room.roomId} room={room} members={members} />
          </>
        )}
      </Box>
    </PowerLevelsContextProvider>
  );
}

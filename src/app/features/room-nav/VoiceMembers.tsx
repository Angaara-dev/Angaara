import React from 'react';
import { Room } from 'matrix-js-sdk';
import { CallMembership } from 'matrix-js-sdk/lib/matrixrtc/CallMembership';
import { useAtomValue } from 'jotai';
import { Avatar, Box, Icon, Icons, Text } from 'folds';
import { UserAvatar } from '../../components/user-avatar';
import { getMemberAvatarMxc, getMemberDisplayName } from '../../utils/room';
import { getMxIdLocalPart, mxcUrlToHttp } from '../../utils/matrix';
import { getMouseEventCords } from '../../utils/dom';
import { useMatrixClient } from '../../hooks/useMatrixClient';
import { useMediaAuthentication } from '../../hooks/useMediaAuthentication';
import { useOpenUserRoomProfile } from '../../state/hooks/userRoomProfile';
import { useCallEmbed } from '../../hooks/useCallEmbed';
import { useCallControlState } from '../../plugins/call';
import { CallEmbed } from '../../plugins/call/CallEmbed';
import { callSpeakersAtom } from '../../state/callEmbed';
import * as css from './VoiceMembers.css';

// Your own mic and sound state; other people's isn't shared outside the call.
function OwnState({ embed }: { embed: CallEmbed }) {
  const { microphone, sound } = useCallControlState(embed.control);
  return (
    <>
      {!microphone && <Icon size="50" src={Icons.MicMute} aria-label="Muted" />}
      {!sound && <Icon size="50" src={Icons.VolumeMute} aria-label="Deafened" />}
    </>
  );
}

type VoiceMembersProps = {
  room: Room;
  members: CallMembership[];
};

// Who's in a voice channel, listed under it like in the channel list of a voice app.
export function VoiceMembers({ room, members }: VoiceMembersProps) {
  const mx = useMatrixClient();
  const useAuthentication = useMediaAuthentication();
  const openUserProfile = useOpenUserRoomProfile();
  const embed = useCallEmbed();
  const speakers = useAtomValue(callSpeakersAtom);
  const inThisCall = embed?.roomId === room.roomId;
  const me = mx.getSafeUserId();

  // One row per person, even when they're in the call from two devices.
  const userIds = Array.from(new Set(members.map((m) => m.sender).filter(Boolean))) as string[];

  return (
    <Box direction="Column" className={css.VoiceMembers}>
      {userIds.map((userId) => {
        const name = getMemberDisplayName(room, userId) ?? getMxIdLocalPart(userId) ?? userId;
        const avatarMxc = getMemberAvatarMxc(room, userId);
        const avatarUrl = avatarMxc
          ? mxcUrlToHttp(mx, avatarMxc, useAuthentication, 48, 48, 'crop') ?? undefined
          : undefined;
        const speaking = inThisCall && speakers.has(userId);
        return (
          <button
            key={userId}
            type="button"
            className={css.VoiceMember}
            onClick={(evt) =>
              openUserProfile(
                room.roomId,
                undefined,
                userId,
                getMouseEventCords(evt.nativeEvent),
                'Right'
              )
            }
          >
            <Avatar size="200" radii="Pill" className={css.VoiceAvatar} data-speaking={speaking}>
              <UserAvatar
                userId={userId}
                src={avatarUrl}
                alt={name}
                renderFallback={() => <Icon size="50" src={Icons.User} filled />}
              />
            </Avatar>
            <Text as="span" size="T200" truncate className={css.VoiceName}>
              {name}
            </Text>
            {inThisCall && embed && userId === me && <OwnState embed={embed} />}
          </button>
        );
      })}
    </Box>
  );
}

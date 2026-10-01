import React from 'react';
import { useMatch } from 'react-router-dom';
import { useAtomValue } from 'jotai';
import { Room } from 'matrix-js-sdk';
import { Avatar, Box, Icon, IconButton, Icons, Text, Tooltip, TooltipProvider } from 'folds';
import { useMatrixClient } from '../../hooks/useMatrixClient';
import { useMediaAuthentication } from '../../hooks/useMediaAuthentication';
import { useRoomName } from '../../hooks/useRoomMeta';
import { useHomeSelected } from '../../hooks/router/useHomeSelected';
import { useDirectSelected } from '../../hooks/router/useDirectSelected';
import { useExploreSelected } from '../../hooks/router/useExploreSelected';
import { useInboxSelected } from '../../hooks/router/useInbox';
import { useCreateSelected } from '../../hooks/router/useCreateSelected';
import { getCanonicalAliasRoomId, isRoomAlias } from '../../utils/matrix';
import { getRoomAvatarUrl } from '../../utils/room';
import { nameInitials } from '../../utils/common';
import { RoomAvatar } from '../../components/room-avatar';
import { UnreadBadge } from '../../components/unread-badge';
import { allInvitesAtom } from '../../state/room-list/inviteList';
import { SPACE_PATH } from '../paths';
import { useOpenInbox } from './sidebar/InboxTab';
import * as css from './TopBar.css';

function SpaceTitle({ space }: { space: Room }) {
  const mx = useMatrixClient();
  const useAuthentication = useMediaAuthentication();
  const name = useRoomName(space);
  return (
    <>
      <Avatar size="200" radii="300">
        <RoomAvatar
          roomId={space.roomId}
          src={getRoomAvatarUrl(mx, space, 32, useAuthentication)}
          alt={name}
          renderFallback={() => (
            <Text as="span" size="L400">
              {nameInitials(name)}
            </Text>
          )}
        />
      </Avatar>
      <Text size="T300" truncate style={{ fontWeight: 600 }}>
        {name}
      </Text>
    </>
  );
}

// Which part of the app is open, named in the bar across the top.
const useSectionName = (): string => {
  const home = useHomeSelected();
  const direct = useDirectSelected();
  const explore = useExploreSelected();
  const inbox = useInboxSelected();
  const create = useCreateSelected();
  if (home) return 'Home';
  if (direct) return 'Direct Messages';
  if (explore) return 'Explore';
  if (inbox) return 'Inbox';
  if (create) return 'Create a Server';
  return 'Angaara';
};

export function TopBar() {
  const mx = useMatrixClient();
  const sectionName = useSectionName();
  const spaceMatch = useMatch({ path: SPACE_PATH, caseSensitive: true, end: false });
  const spaceIdOrAlias = spaceMatch?.params.spaceIdOrAlias;
  const spaceId =
    spaceIdOrAlias && isRoomAlias(spaceIdOrAlias)
      ? getCanonicalAliasRoomId(mx, spaceIdOrAlias)
      : spaceIdOrAlias;
  const space = spaceId ? mx.getRoom(spaceId) : null;
  const inSpace = sectionName === 'Angaara' && space?.isSpaceRoom();

  const inboxSelected = useInboxSelected();
  const inviteCount = useAtomValue(allInvitesAtom).length;
  const openInbox = useOpenInbox();

  return (
    <Box className={css.TopBar} shrink="No" alignItems="Center" justifyContent="Center">
      <Box className={css.Title} alignItems="Center" justifyContent="Center" gap="200">
        {inSpace && space ? (
          <SpaceTitle space={space} />
        ) : (
          <Text size="T300" truncate style={{ fontWeight: 600 }}>
            {sectionName}
          </Text>
        )}
      </Box>
      <Box className={css.Actions} alignItems="Center">
        <TooltipProvider
          position="Bottom"
          align="End"
          offset={4}
          tooltip={
            <Tooltip>
              <Text size="T200">Inbox</Text>
            </Tooltip>
          }
        >
          {(triggerRef) => (
            <IconButton
              ref={triggerRef}
              size="300"
              radii="300"
              variant="Background"
              fill="None"
              aria-label="Inbox"
              aria-pressed={inboxSelected}
              onClick={openInbox}
            >
              <Icon size="200" src={Icons.Inbox} filled={inboxSelected} />
            </IconButton>
          )}
        </TooltipProvider>
        {inviteCount > 0 && (
          <span className={css.Badge}>
            <UnreadBadge highlight count={inviteCount} />
          </span>
        )}
      </Box>
    </Box>
  );
}

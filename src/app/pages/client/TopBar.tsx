import React, { useState } from 'react';
import FocusTrap from 'focus-trap-react';
import { useMatch } from 'react-router-dom';
import { useAtomValue } from 'jotai';
import { Room } from 'matrix-js-sdk';
import {
  Avatar,
  Box,
  Icon,
  IconButton,
  Icons,
  PopOut,
  RectCords,
  Text,
  Tooltip,
  TooltipProvider,
  toRem,
} from 'folds';
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
import { stopPropagation } from '../../utils/keyboard';
import { InvitesFeed, NotificationsFeed } from './inbox';
import * as css from './TopBar.css';

function SpaceTitle({ space }: { space: Room }) {
  const mx = useMatrixClient();
  const useAuthentication = useMediaAuthentication();
  const name = useRoomName(space);
  return (
    <>
      <Avatar size="200" radii="300" style={{ width: toRem(20), height: toRem(20) }}>
        <RoomAvatar
          roomId={space.roomId}
          src={getRoomAvatarUrl(mx, space, 32, useAuthentication)}
          alt={name}
          renderFallback={() => (
            <Text as="span" size="T200">
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

type InboxTab = 'notifications' | 'invites';

function InboxPanel({ requestClose }: { requestClose: () => void }) {
  const inviteCount = useAtomValue(allInvitesAtom).length;
  const [tab, setTab] = useState<InboxTab>(inviteCount > 0 ? 'invites' : 'notifications');
  const [onlyHighlight, setOnlyHighlighted] = useState(false);

  const tabButton = (key: InboxTab, label: string) => (
    <button
      type="button"
      className={css.Tab}
      aria-pressed={tab === key}
      onClick={() => setTab(key)}
    >
      <Text as="span" size="T300" style={{ fontWeight: 600 }}>
        {label}
      </Text>
    </button>
  );

  return (
    // Pop-outs sit outside the app root, so they opt in to the server's colours here.
    <div className={css.InboxPanel} data-theme-wash>
      <Box className={css.InboxHeader} alignItems="Center" gap="200">
        <Icon size="200" src={Icons.Inbox} filled />
        <Box grow="Yes">
          <Text size="H4">Inbox</Text>
        </Box>
        <IconButton size="300" radii="300" aria-label="Close" onClick={requestClose}>
          <Icon size="100" src={Icons.Cross} />
        </IconButton>
      </Box>
      <Box className={css.Tabs}>
        {tabButton('notifications', 'Notifications')}
        {tabButton('invites', inviteCount > 0 ? `Invites (${inviteCount})` : 'Invites')}
      </Box>
      <Box direction="Column" grow="Yes" style={{ minHeight: 0 }}>
        {tab === 'notifications' ? (
          <NotificationsFeed
            onlyHighlight={onlyHighlight}
            setOnlyHighlighted={setOnlyHighlighted}
            onOpen={requestClose}
          />
        ) : (
          <InvitesFeed onOpen={requestClose} />
        )}
      </Box>
    </div>
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

  const inviteCount = useAtomValue(allInvitesAtom).length;
  const [inboxAnchor, setInboxAnchor] = useState<RectCords>();
  const closeInbox = () => setInboxAnchor(undefined);

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
              style={{ width: toRem(24), height: toRem(24), minWidth: 0, padding: 0 }}
              variant="Background"
              fill="None"
              aria-label="Inbox"
              aria-pressed={!!inboxAnchor}
              onClick={(evt: React.MouseEvent<HTMLButtonElement>) =>
                setInboxAnchor(inboxAnchor ? undefined : evt.currentTarget.getBoundingClientRect())
              }
            >
              <Icon size="100" src={Icons.Inbox} filled={!!inboxAnchor} />
            </IconButton>
          )}
        </TooltipProvider>
        <PopOut
          anchor={inboxAnchor}
          position="Bottom"
          align="End"
          offset={6}
          content={
            <FocusTrap
              focusTrapOptions={{
                initialFocus: false,
                returnFocusOnDeactivate: false,
                onDeactivate: closeInbox,
                clickOutsideDeactivates: true,
                escapeDeactivates: stopPropagation,
              }}
            >
              {/* A plain element, so the focus trap can hold on to it. */}
              <div>
                <InboxPanel requestClose={closeInbox} />
              </div>
            </FocusTrap>
          }
        />
        {inviteCount > 0 && (
          <span className={css.Badge}>
            <UnreadBadge highlight count={inviteCount} />
          </span>
        )}
      </Box>
    </Box>
  );
}

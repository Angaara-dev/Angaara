import React, { useEffect, useReducer, useState } from 'react';
import {
  Avatar,
  Badge,
  Box,
  Header,
  Icon,
  IconButton,
  Icons,
  Scroll,
  Spinner,
  Text,
  color,
  config,
} from 'folds';
import { ClientEvent, Room, RoomEvent, RoomStateEvent } from 'matrix-js-sdk';
import { useNavigate } from 'react-router-dom';
import { useMatrixClient } from '../../hooks/useMatrixClient';
import { NavButton, NavItem, NavItemContent } from '../../components/nav';
import { Modal500 } from '../../components/Modal500';
import { getSpaceRoomPath } from '../../pages/pathUtils';
import { getCanonicalAliasOrRoomId } from '../../utils/matrix';
import { Membership } from '../../../types/matrix/room';
import {
  appealsEnabled,
  canUnbanIn,
  getAppeal,
  getAppellant,
  appealMax,
  spaceAppeals,
} from './appeals';

// Re-renders whenever rooms, memberships or appeal states change.
const useRoomsTick = () => {
  const mx = useMatrixClient();
  const [, tick] = useReducer((n: number) => n + 1, 0);
  useEffect(() => {
    mx.on(ClientEvent.Room, tick);
    mx.on(RoomEvent.MyMembership, tick);
    mx.on(RoomStateEvent.Events, tick);
    return () => {
      mx.removeListener(ClientEvent.Room, tick);
      mx.removeListener(RoomEvent.MyMembership, tick);
      mx.removeListener(RoomStateEvent.Events, tick);
    };
  }, [mx]);
};

type TicketProps = { room: Room; onOpen: (room: Room) => Promise<void> };
function Ticket({ room, onOpen }: TicketProps) {
  const mx = useMatrixClient();
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState<string>();
  const appeal = getAppeal(room);
  const invited = room.getMyMembership() === Membership.Invite;
  const user = getAppellant(room);
  const name = (user && room.getMember(user)?.name) || user || 'Someone';
  const created = room.currentState.getStateEvents('m.room.create', '')?.getTs();

  let status = invited ? 'Waiting for you to open it' : 'Open';
  if (appeal?.status === 'accepted') status = 'Unbanned';
  else if (appeal?.status === 'denied' || appeal?.status === 'closed') status = 'Denied';
  else if (appeal?.archived) status = 'Closed';

  const open = async () => {
    setOpening(true);
    setError(undefined);
    try {
      await onOpen(room);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't open it.");
      setOpening(false);
    }
  };

  return (
    <Box
      as="button"
      type="button"
      direction="Column"
      gap="100"
      onClick={open}
      disabled={opening}
      style={{
        padding: config.space.S300,
        borderRadius: config.radii.R400,
        background: color.SurfaceVariant.Container,
        color: 'inherit',
        textAlign: 'left',
        cursor: 'pointer',
        border: 'none',
      }}
    >
      <Box alignItems="Center" gap="200">
        <Text size="T300" style={{ flexGrow: 1 }} truncate>
          <b>{invited ? room.name : name}</b>
        </Text>
        {opening && <Spinner size="50" variant="Secondary" />}
      </Box>
      <Text size="T200" priority="300">
        {status}
        {appeal && ` · appeal ${appeal.attempt} of ${appealMax(appeal)}`}
        {created && ` · ${new Date(created).toLocaleDateString()}`}
        {user && user === mx.getSafeUserId() && ' · yours'}
      </Text>
      {error && (
        <Text size="T200" style={{ color: color.Critical.Main }}>
          {error}
        </Text>
      )}
    </Box>
  );
}

function Section({
  title,
  rooms,
  onOpen,
}: { title: string; rooms: Room[] } & Pick<TicketProps, 'onOpen'>) {
  if (rooms.length === 0) return null;
  return (
    <Box direction="Column" gap="200">
      <Text size="L400">{title}</Text>
      {rooms.map((room) => (
        <Ticket key={room.roomId} room={room} onOpen={onOpen} />
      ))}
    </Box>
  );
}

// Lists a server's appeal tickets: open ones you were picked for, and closed ones for every mod.
function AppealsPanel({ space, requestClose }: { space: Room; requestClose: () => void }) {
  const mx = useMatrixClient();
  const navigate = useNavigate();
  useRoomsTick();
  const tickets = spaceAppeals(mx, space);
  const invites = tickets.filter((r) => r.getMyMembership() === Membership.Invite);
  const open = tickets.filter(
    (r) => r.getMyMembership() === Membership.Join && !getAppeal(r)?.archived
  );
  const archived = tickets.filter(
    (r) => r.getMyMembership() === Membership.Join && getAppeal(r)?.archived
  );

  const onOpen = async (room: Room) => {
    if (room.getMyMembership() === Membership.Invite) await mx.joinRoom(room.roomId);
    requestClose();
    navigate(getSpaceRoomPath(getCanonicalAliasOrRoomId(mx, space.roomId), room.roomId));
  };

  return (
    <Modal500 requestClose={requestClose}>
      <Box direction="Column" style={{ height: '100%', minHeight: 0 }}>
        <Header
          size="500"
          style={{ padding: `0 ${config.space.S200} 0 ${config.space.S400}`, flexShrink: 0 }}
        >
          <Box grow="Yes">
            <Text size="H4">Appeals</Text>
          </Box>
          <IconButton size="300" radii="300" onClick={requestClose} aria-label="Close">
            <Icon src={Icons.Cross} />
          </IconButton>
        </Header>
        <Box grow="Yes" style={{ minHeight: 0 }}>
          <Scroll hideTrack visibility="Hover">
            <Box direction="Column" gap="500" style={{ padding: config.space.S400 }}>
              {!appealsEnabled(space) && (
                <Text size="T300" priority="300">
                  Ban appeals are off for this server. Turn them on in server settings.
                </Text>
              )}
              <Section title="New" rooms={invites} onOpen={onOpen} />
              <Section title="Open" rooms={open} onOpen={onOpen} />
              <Section title="Archived Chats" rooms={archived} onOpen={onOpen} />
              {tickets.length === 0 && (
                <Text size="T300" priority="300">
                  No appeals yet. Open appeals only show for the mod they were sent to, and closed
                  ones are archived here for everyone who can ban.
                </Text>
              )}
            </Box>
          </Scroll>
        </Box>
      </Box>
    </Modal500>
  );
}

// Sidebar entry, only for people who can ban and unban in this server.
export function AppealsNavItem({ space }: { space: Room }) {
  const mx = useMatrixClient();
  useRoomsTick();
  const [open, setOpen] = useState(false);
  if (!canUnbanIn(mx, space)) return null;
  const tickets = spaceAppeals(mx, space);
  if (!appealsEnabled(space) && tickets.length === 0) return null;
  const waiting = tickets.filter(
    (r) => r.getMyMembership() === Membership.Invite || !getAppeal(r)?.archived
  ).length;

  return (
    <>
      <NavItem variant="Background" radii="400">
        <NavButton onClick={() => setOpen(true)}>
          <NavItemContent>
            <Box as="span" grow="Yes" alignItems="Center" gap="200">
              <Avatar size="200" radii="400">
                <Icon src={Icons.Prohibited} size="100" />
              </Avatar>
              <Box as="span" grow="Yes">
                <Text as="span" size="Inherit" truncate>
                  Appeals
                </Text>
              </Box>
              {waiting > 0 && (
                <Badge variant="Critical" fill="Solid" radii="Pill" size="400">
                  <Text as="span" size="L400">
                    {waiting}
                  </Text>
                </Badge>
              )}
            </Box>
          </NavItemContent>
        </NavButton>
      </NavItem>
      {open && <AppealsPanel space={space} requestClose={() => setOpen(false)} />}
    </>
  );
}

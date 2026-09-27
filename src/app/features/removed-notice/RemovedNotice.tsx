import React, { useEffect, useState } from 'react';
import FocusTrap from 'focus-trap-react';
import {
  Box,
  Button,
  color,
  config,
  Dialog,
  Overlay,
  OverlayBackdrop,
  OverlayCenter,
  Spinner,
  Text,
  toRem,
} from 'folds';
import { MatrixClient, Room, RoomEvent } from 'matrix-js-sdk';
import { useNavigate } from 'react-router-dom';
import { useMatrixClient } from '../../hooks/useMatrixClient';
import { getMxIdServer } from '../../utils/matrix';
import { Membership } from '../../../types/matrix/room';
import { getRoomCreatorsForRoomId } from '../../hooks/useRoomCreators';
import { getDirectCreatePath, withSearchParam } from '../../pages/pathUtils';
import { DirectCreateSearchParams } from '../../pages/paths';

type Removal = {
  roomId: string;
  name: string;
  space: boolean;
  banned: boolean;
  by: string;
  byId: string;
  reason?: string;
  // Set when the notice comes from trying to join again, rather than the ban itself.
  retry?: boolean;
  mods: { id: string; name: string }[];
};

// People with the power to ban and unban here (plus creators), for a banned user to appeal to.
const getMods = (mx: MatrixClient, room: Room | null): Removal['mods'] => {
  if (!room) return [];
  const myId = mx.getSafeUserId();
  const pl = room.currentState.getStateEvents('m.room.power_levels', '')?.getContent() ?? {};
  const need = pl.ban ?? 50;
  const ids = new Set(getRoomCreatorsForRoomId(mx, room.roomId));
  Object.entries<number>(pl.users ?? {}).forEach(([id, level]) => {
    if (level >= need) ids.add(id);
  });
  ids.delete(myId);
  return [...ids].slice(0, 8).map((id) => ({ id, name: room.getMember(id)?.name ?? id }));
};

const isBanError = (e: unknown) =>
  !!e && typeof e === 'object' && /banned/i.test(String((e as { message?: string }).message));

// Ignore removals replayed from before this session (e.g. while offline for ages).
const RECENT_MS = 10 * 60 * 1000;

// Tells you when someone else kicked or banned you from a room or server.
export function RemovedNotice() {
  const mx = useMatrixClient();
  const navigate = useNavigate();
  const [queue, setQueue] = useState<Removal[]>([]);
  const [rejoining, setRejoining] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    const myId = mx.getSafeUserId();
    const onMembership = (room: Room, membership: string, prev?: string) => {
      if (prev !== Membership.Join) return;
      if (membership !== Membership.Leave && membership !== Membership.Ban) return;
      const event = room.getMember(myId)?.events.member;
      const by = event?.getSender();
      if (!event || !by || by === myId) return;
      if (Date.now() - event.getTs() > RECENT_MS) return;
      const removal: Removal = {
        roomId: room.roomId,
        name: room.name,
        space: room.isSpaceRoom(),
        banned: membership === Membership.Ban,
        by: room.getMember(by)?.name ?? by,
        byId: by,
        reason: event.getContent().reason,
        mods: membership === Membership.Ban ? getMods(mx, room) : [],
      };
      setQueue((q) => [...q.filter((r) => r.roomId !== room.roomId), removal]);
    };
    mx.on(RoomEvent.MyMembership, onMembership);

    // Every join in the app goes through mx.joinRoom, so catch bans there in one place.
    const { joinRoom } = mx;
    mx.joinRoom = async (...args: Parameters<MatrixClient['joinRoom']>) => {
      try {
        return await joinRoom.apply(mx, args);
      } catch (e) {
        if (isBanError(e)) {
          const room = mx.getRoom(args[0]);
          const removal: Removal = {
            roomId: room?.roomId ?? args[0],
            name: room?.name ?? args[0],
            // Unknown rooms are usually servers picked from Explore.
            space: room ? room.isSpaceRoom() : true,
            banned: true,
            retry: true,
            by: '',
            byId: '',
            mods: getMods(mx, room),
          };
          setQueue((q) => [...q.filter((r) => r.roomId !== removal.roomId), removal]);
        }
        throw e;
      }
    };
    return () => {
      mx.removeListener(RoomEvent.MyMembership, onMembership);
      mx.joinRoom = joinRoom;
    };
  }, [mx]);

  const current = queue[0];
  if (!current) return null;

  const dismiss = () => {
    setError(undefined);
    setQueue((q) => q.slice(1));
  };

  const rejoin = async () => {
    setRejoining(true);
    setError(undefined);
    try {
      // The remover's server is sure to be in the room, so it can route the join.
      const via = getMxIdServer(current.byId);
      await mx.joinRoom(current.roomId, via ? { viaServers: [via] } : undefined);
      dismiss();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't rejoin.");
    }
    setRejoining(false);
  };

  const message = (userId: string) => {
    dismiss();
    const params: DirectCreateSearchParams = { userId };
    navigate(withSearchParam(getDirectCreatePath(), params));
  };

  const place = current.space ? 'server' : 'room';
  const action = current.banned ? 'banned' : 'kicked';

  return (
    <Overlay open backdrop={<OverlayBackdrop />}>
      <OverlayCenter>
        <FocusTrap
          focusTrapOptions={{
            initialFocus: false,
            onDeactivate: dismiss,
            clickOutsideDeactivates: true,
            escapeDeactivates: true,
          }}
        >
          <Dialog style={{ maxWidth: toRem(380) }}>
            <Box direction="Column" gap="400" style={{ padding: config.space.S500 }}>
              <Text size="H4">
                {current.retry
                  ? `You were banned from this ${place}`
                  : `You were ${action} from ${current.name}`}
              </Text>
              <Text size="T300">
                {!current.retry && `${current.by} removed you from this ${place}. `}
                {current.banned
                  ? `You can't rejoin until you're unbanned.`
                  : `You may rejoin this ${place} if needed.`}
              </Text>
              {current.reason && (
                <Box
                  direction="Column"
                  gap="100"
                  style={{
                    padding: config.space.S300,
                    borderRadius: config.radii.R400,
                    background: color.SurfaceVariant.Container,
                  }}
                >
                  <Text size="L400">Reason</Text>
                  <Text size="T300" style={{ overflowWrap: 'anywhere' }}>
                    {current.reason}
                  </Text>
                </Box>
              )}
              {current.mods.length > 0 && (
                <Box direction="Column" gap="200">
                  <Text size="L400">Think this was a mistake? These people can unban you.</Text>
                  {current.mods.map((mod) => (
                    <Box key={mod.id} alignItems="Center" gap="200">
                      <Box grow="Yes" direction="Column" style={{ minWidth: 0 }}>
                        <Text size="T300" truncate>
                          <b>{mod.name}</b>
                        </Text>
                        <Text size="T200" priority="300" truncate>
                          {mod.id}
                        </Text>
                      </Box>
                      <Button
                        size="300"
                        variant="Secondary"
                        fill="Soft"
                        radii="300"
                        onClick={() => message(mod.id)}
                      >
                        <Text size="B300">Message</Text>
                      </Button>
                    </Box>
                  ))}
                </Box>
              )}
              {error && (
                <Text size="T200" style={{ color: color.Critical.Main }}>
                  <b>{error}</b>
                </Text>
              )}
              <Box direction="Column" gap="200">
                {!current.banned && (
                  <Button
                    variant="Primary"
                    radii="400"
                    onClick={rejoin}
                    disabled={rejoining}
                    before={rejoining && <Spinner size="100" variant="Primary" fill="Solid" />}
                  >
                    <Text size="B400">Rejoin</Text>
                  </Button>
                )}
                <Button
                  variant="Secondary"
                  fill="Soft"
                  radii="400"
                  onClick={dismiss}
                  disabled={rejoining}
                >
                  <Text size="B400">Okay</Text>
                </Button>
              </Box>
            </Box>
          </Dialog>
        </FocusTrap>
      </OverlayCenter>
    </Overlay>
  );
}

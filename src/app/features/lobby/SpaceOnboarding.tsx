import React, { useCallback, useMemo, useState } from 'react';
import FocusTrap from 'focus-trap-react';
import { atom } from 'jotai';
import { JoinRule, Room } from 'matrix-js-sdk';
import { IHierarchyRoom } from 'matrix-js-sdk/lib/@types/spaces';
import {
  Avatar,
  Badge,
  Box,
  Button,
  Checkbox,
  Dialog,
  Header,
  Icon,
  IconButton,
  Icons,
  Overlay,
  OverlayBackdrop,
  OverlayCenter,
  Scroll,
  Spinner,
  Text,
  color,
  config,
  toRem,
} from 'folds';
import { useMatrixClient } from '../../hooks/useMatrixClient';
import { useMediaAuthentication } from '../../hooks/useMediaAuthentication';
import { useFetchSpaceHierarchyLevel } from '../../hooks/useSpaceHierarchy';
import { useRoomName } from '../../hooks/useRoomMeta';
import { AsyncStatus, useAsyncCallback } from '../../hooks/useAsyncCallback';
import { RoomAvatar, RoomIcon } from '../../components/room-avatar';
import { getStateEvents, isValidChild } from '../../utils/room';
import { mxcUrlToHttp } from '../../utils/matrix';
import { millify } from '../../plugins/millify';
import { stopPropagation } from '../../utils/keyboard';
import { MSpaceChildContent, StateEvent } from '../../../types/matrix/room';

// Space id whose room picker is open.
export const spaceOnboardingAtom = atom<string | undefined>(undefined);

const SEEN_KEY = 'hearth_onboarded_spaces';
const getSeenSpaces = (): string[] => {
  try {
    const seen = JSON.parse(localStorage.getItem(SEEN_KEY) ?? '[]');
    return Array.isArray(seen) ? seen : [];
  } catch {
    return [];
  }
};
const markSpaceSeen = (spaceId: string) => {
  try {
    const seen = getSeenSpaces().filter((id) => id !== spaceId);
    localStorage.setItem(SEEN_KEY, JSON.stringify([...seen, spaceId].slice(-200)));
  } catch {
    // storage blocked, picker may show again
  }
};

type SpaceChild = { roomId: string; via: string[]; suggested: boolean; order?: string };
const getSpaceChildren = (space: Room): SpaceChild[] =>
  getStateEvents(space, StateEvent.SpaceChild)
    .filter(isValidChild)
    .map((e) => {
      const content = e.getContent<MSpaceChildContent>();
      return {
        roomId: e.getStateKey() ?? '',
        via: content.via ?? [],
        suggested: !!content.suggested,
        order: typeof content.order === 'string' ? content.order : undefined,
      };
    })
    .filter((child) => !!child.roomId);

// Show the picker once per space, and only if you haven't joined any of its rooms yet.
export const shouldOnboardSpace = (space: Room): boolean => {
  if (getSeenSpaces().includes(space.roomId)) return false;
  const mx = space.client;
  const children = getSpaceChildren(space);
  if (children.length === 0) return false;
  return !children.some((child) => {
    const room = mx.getRoom(child.roomId);
    return room?.getMyMembership() === 'join' && !room.isSpaceRoom();
  });
};

type PickerRowProps = {
  summary: IHierarchyRoom;
  suggested: boolean;
  joined: boolean;
  checked: boolean;
  disabled: boolean;
  onToggle: (roomId: string) => void;
};
function PickerRow({ summary, suggested, joined, checked, disabled, onToggle }: PickerRowProps) {
  const mx = useMatrixClient();
  const useAuthentication = useMediaAuthentication();
  const name = summary.name || summary.canonical_alias || summary.room_id;
  const avatarUrl = summary.avatar_url
    ? mxcUrlToHttp(mx, summary.avatar_url, useAuthentication, 96, 96, 'crop') ?? undefined
    : undefined;

  return (
    <Box
      as="label"
      alignItems="Center"
      gap="300"
      style={{
        padding: config.space.S300,
        borderRadius: config.radii.R400,
        background: checked ? color.SurfaceVariant.ContainerActive : color.SurfaceVariant.Container,
        cursor: joined || disabled ? 'default' : 'pointer',
      }}
    >
      <Avatar size="300">
        <RoomAvatar
          roomId={summary.room_id}
          src={avatarUrl}
          alt={name}
          renderFallback={() => (
            <RoomIcon
              size="200"
              joinRule={summary.join_rule as JoinRule}
              roomType={summary.room_type}
            />
          )}
        />
      </Avatar>
      <Box grow="Yes" direction="Column" gap="100" style={{ minWidth: 0 }}>
        <Box alignItems="Center" gap="200">
          <Text size="T300" truncate>
            <b>{name}</b>
          </Text>
          {suggested && !joined && (
            <Badge variant="Success" fill="Soft" radii="300">
              <Text size="L400">Suggested</Text>
            </Badge>
          )}
        </Box>
        <Text size="T200" priority="300" truncate>
          {millify(summary.num_joined_members)} Members
          {summary.topic && ` · ${summary.topic}`}
        </Text>
      </Box>
      {joined ? (
        <Text size="T200" priority="300">
          Joined
        </Text>
      ) : (
        <Checkbox
          checked={checked}
          disabled={disabled}
          onClick={() => onToggle(summary.room_id)}
          variant="Primary"
          size="200"
          aria-label={`Join ${name}`}
        />
      )}
    </Box>
  );
}

type SpaceOnboardingProps = {
  space: Room;
  requestClose: () => void;
};
export function SpaceOnboarding({ space, requestClose }: SpaceOnboardingProps) {
  const mx = useMatrixClient();
  const spaceName = useRoomName(space);
  const { fetching, rooms: summaries } = useFetchSpaceHierarchyLevel(space.roomId, true);

  const children = useMemo(() => getSpaceChildren(space), [space]);
  const isJoined = useCallback(
    (roomId: string) => mx.getRoom(roomId)?.getMyMembership() === 'join',
    [mx]
  );

  // Only rooms the server could describe; sub-spaces are left to the lobby.
  const pickable = useMemo(
    () =>
      children
        .filter((child) => {
          const summary = summaries.get(child.roomId);
          return summary && summary.room_type !== 'm.space';
        })
        .sort((a, b) => Number(b.suggested) - Number(a.suggested)),
    [children, summaries]
  );

  const [selected, setSelected] = useState<Set<string>>();
  const defaultSelected = useMemo(
    () => new Set(pickable.filter((c) => c.suggested && !isJoined(c.roomId)).map((c) => c.roomId)),
    [pickable, isJoined]
  );
  const currentSelected = selected ?? defaultSelected;

  const toggle = (roomId: string) => {
    const next = new Set(currentSelected);
    if (next.has(roomId)) next.delete(roomId);
    else next.add(roomId);
    setSelected(next);
  };

  const [failed, setFailed] = useState<string[]>([]);
  const [joinState, joinSelected] = useAsyncCallback(
    useCallback(async () => {
      const toJoin = pickable.filter((c) => currentSelected.has(c.roomId) && !isJoined(c.roomId));
      const errors: string[] = [];
      // One at a time to stay under join rate limits.
      await toJoin.reduce<Promise<unknown>>(
        (prev, child) =>
          prev.then(() =>
            mx.joinRoom(child.roomId, { viaServers: child.via }).catch(() => {
              errors.push(summaries.get(child.roomId)?.name ?? child.roomId);
            })
          ),
        Promise.resolve()
      );
      return errors;
    }, [mx, pickable, currentSelected, isJoined, summaries])
  );
  const joining = joinState.status === AsyncStatus.Loading;

  const handleClose = () => {
    markSpaceSeen(space.roomId);
    requestClose();
  };

  const handleJoin = async () => {
    const errors = await joinSelected();
    if (errors.length === 0) handleClose();
    else setFailed(errors);
  };

  const count = [...currentSelected].filter((id) => !isJoined(id)).length;
  const allSelectable = pickable.filter((c) => !isJoined(c.roomId));
  const allChecked = allSelectable.length > 0 && count === allSelectable.length;

  return (
    <Overlay open backdrop={<OverlayBackdrop />}>
      <OverlayCenter>
        <FocusTrap
          focusTrapOptions={{
            initialFocus: false,
            onDeactivate: handleClose,
            clickOutsideDeactivates: !joining,
            escapeDeactivates: stopPropagation,
          }}
        >
          <Dialog variant="Surface" style={{ maxWidth: toRem(520), width: '100vw' }}>
            <Header
              style={{ padding: `0 ${config.space.S200} 0 ${config.space.S400}` }}
              variant="Surface"
              size="500"
            >
              <Box grow="Yes" />
              <IconButton size="300" radii="300" onClick={handleClose} aria-label="Close">
                <Icon src={Icons.Cross} />
              </IconButton>
            </Header>
            <Box
              direction="Column"
              gap="100"
              style={{ padding: `0 ${config.space.S400} ${config.space.S300}` }}
            >
              <Text size="H3">Pick the rooms you want to join</Text>
              <Text size="T300" priority="300">
                In <b>{spaceName}</b>. You can join more later from the lobby.
              </Text>
            </Box>
            <Box
              justifyContent="SpaceBetween"
              alignItems="Center"
              style={{ padding: `0 ${config.space.S400} ${config.space.S200}` }}
            >
              <Text size="L400">
                {pickable.length} {pickable.length === 1 ? 'Room' : 'Rooms'}
              </Text>
              {allSelectable.length > 0 && (
                <Button
                  size="300"
                  variant="Secondary"
                  fill="None"
                  radii="300"
                  disabled={joining}
                  onClick={() =>
                    setSelected(
                      allChecked ? new Set() : new Set(allSelectable.map((c) => c.roomId))
                    )
                  }
                >
                  <Text size="B300">{allChecked ? 'Clear All' : 'Select All'}</Text>
                </Button>
              )}
            </Box>
            <Box style={{ maxHeight: '50vh', position: 'relative' }} direction="Column">
              <Scroll size="300" hideTrack>
                <Box
                  direction="Column"
                  gap="200"
                  style={{ padding: `0 ${config.space.S400} ${config.space.S300}` }}
                >
                  {fetching && pickable.length === 0 && (
                    <Box justifyContent="Center" style={{ padding: config.space.S400 }}>
                      <Spinner variant="Secondary" size="400" />
                    </Box>
                  )}
                  {!fetching && pickable.length === 0 && (
                    <Text size="T300" priority="300" align="Center">
                      No rooms to join here yet.
                    </Text>
                  )}
                  {pickable.map((child) => {
                    const summary = summaries.get(child.roomId);
                    if (!summary) return null;
                    const joined = isJoined(child.roomId);
                    return (
                      <PickerRow
                        key={child.roomId}
                        summary={summary}
                        suggested={child.suggested}
                        joined={joined}
                        checked={joined || currentSelected.has(child.roomId)}
                        disabled={joining}
                        onToggle={toggle}
                      />
                    );
                  })}
                </Box>
              </Scroll>
            </Box>
            {failed.length > 0 && (
              <Text
                size="T200"
                style={{ color: color.Critical.Main, padding: `0 ${config.space.S400}` }}
              >
                Couldn&apos;t join: {failed.join(', ')}
              </Text>
            )}
            <Box gap="200" justifyContent="End" style={{ padding: config.space.S400 }}>
              <Button variant="Secondary" fill="Soft" onClick={handleClose} disabled={joining}>
                <Text size="B400">{failed.length > 0 ? 'Done' : 'Skip'}</Text>
              </Button>
              <Button
                variant="Primary"
                onClick={handleJoin}
                disabled={count === 0 || joining}
                before={joining && <Spinner variant="Primary" fill="Solid" size="200" />}
              >
                <Text size="B400">
                  {joining ? 'Joining...' : `Join ${count} ${count === 1 ? 'Room' : 'Rooms'}`}
                </Text>
              </Button>
            </Box>
          </Dialog>
        </FocusTrap>
      </OverlayCenter>
    </Overlay>
  );
}

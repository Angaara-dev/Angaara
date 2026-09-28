import React, { useRef, useState } from 'react';
import FocusTrap from 'focus-trap-react';
import {
  Box,
  Button,
  color,
  config,
  Icon,
  Icons,
  Menu,
  PopOut,
  RectCords,
  Spinner,
  Text,
  toRem,
} from 'folds';
import { Room } from 'matrix-js-sdk';
import { useQuery } from '@tanstack/react-query';
import { useMatrixClient } from '../../hooks/useMatrixClient';
import { useMediaAuthentication } from '../../hooks/useMediaAuthentication';
import { useRoomBannerUrl } from '../../hooks/useRoomBanner';
import { useRoomNavigate } from '../../hooks/useRoomNavigate';
import { getRoomAvatarUrl } from '../../utils/room';
import { getMxIdServer, mxcUrlToHttp } from '../../utils/matrix';
import { nameInitials } from '../../utils/common';
import { millify } from '../../plugins/millify';
import { stopPropagation } from '../../utils/keyboard';
import { Membership } from '../../../types/matrix/room';
import { bannerFallback } from './bannerFallback';

type CardInfo = {
  name: string;
  avatarUrl?: string;
  bannerUrl?: string;
  topic?: string;
  members?: number;
  created?: number;
};

const AVATAR = toRem(64);

function CardBody({ info, action }: { info: CardInfo; action: React.ReactNode }) {
  return (
    <Box direction="Column" style={{ width: toRem(280) }}>
      <div
        style={{
          height: toRem(96),
          borderRadius: `${config.radii.R400} ${config.radii.R400} 0 0`,
          background: info.bannerUrl
            ? `center / cover no-repeat url("${info.bannerUrl}")`
            : bannerFallback(info.name),
        }}
      />
      <Box
        direction="Column"
        gap="200"
        style={{ padding: `0 ${config.space.S400} ${config.space.S400}` }}
      >
        <Box
          alignItems="Center"
          justifyContent="Center"
          style={{
            width: AVATAR,
            height: AVATAR,
            marginTop: `calc(${AVATAR} / -2)`,
            borderRadius: config.radii.R500,
            overflow: 'hidden',
            background: color.SurfaceVariant.Container,
            border: `${toRem(4)} solid ${color.Surface.Container}`,
          }}
        >
          {info.avatarUrl ? (
            <img
              src={info.avatarUrl}
              alt=""
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : (
            <Text size="H3">{nameInitials(info.name)}</Text>
          )}
        </Box>
        <Text size="H4" truncate>
          {info.name}
        </Text>
        <Box gap="300" wrap="Wrap">
          {typeof info.members === 'number' && (
            <Box alignItems="Center" gap="100">
              <Icon size="50" src={Icons.User} />
              <Text size="T200" priority="300">
                {millify(info.members)} Members
              </Text>
            </Box>
          )}
          {info.created && (
            <Text size="T200" priority="300">
              Est.{' '}
              {new Date(info.created).toLocaleDateString(undefined, {
                month: 'short',
                year: 'numeric',
              })}
            </Text>
          )}
        </Box>
        {info.topic && (
          <Text size="T300" priority="300" style={{ overflowWrap: 'anywhere' }}>
            {info.topic.length > 180 ? `${info.topic.slice(0, 180)}…` : info.topic}
          </Text>
        )}
        {action}
      </Box>
    </Box>
  );
}

// A server you're in: everything is known locally, including its banner and age.
function JoinedServer({ space, onClose }: { space: Room; onClose: () => void }) {
  const mx = useMatrixClient();
  const useAuthentication = useMediaAuthentication();
  const { navigateSpace } = useRoomNavigate();
  const info: CardInfo = {
    name: space.name,
    avatarUrl: getRoomAvatarUrl(mx, space, 96, useAuthentication),
    bannerUrl: useRoomBannerUrl(space),
    topic: space.currentState.getStateEvents('m.room.topic', '')?.getContent()?.topic,
    members: space.getJoinedMemberCount(),
    created: space.currentState.getStateEvents('m.room.create', '')?.getTs(),
  };
  return (
    <CardBody
      info={info}
      action={
        <Button
          variant="Secondary"
          fill="Soft"
          radii="300"
          size="400"
          onClick={() => {
            onClose();
            navigateSpace(space.roomId);
          }}
        >
          <Text size="B400">View Server</Text>
        </Button>
      }
    />
  );
}

// A server you're not in: only its public summary is available.
function OtherServer({
  spaceId,
  via,
  onClose,
}: {
  spaceId: string;
  via?: string;
  onClose: () => void;
}) {
  const mx = useMatrixClient();
  const useAuthentication = useMediaAuthentication();
  const { navigateSpace } = useRoomNavigate();
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string>();
  const { data, isError, isLoading } = useQuery({
    queryKey: [spaceId, 'summary', via],
    queryFn: () => mx.getRoomSummary(spaceId, via ? [via] : undefined),
    retry: false,
  });

  if (isLoading) {
    return (
      <Box
        alignItems="Center"
        justifyContent="Center"
        style={{ width: toRem(280), padding: config.space.S500 }}
      >
        <Spinner variant="Secondary" />
      </Box>
    );
  }

  const join = async () => {
    setJoining(true);
    setError(undefined);
    try {
      await mx.joinRoom(spaceId, via ? { viaServers: [via] } : undefined);
      onClose();
      navigateSpace(spaceId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't join.");
      setJoining(false);
    }
  };

  // Private servers don't share a summary, so all that's left is to try joining.
  const info: CardInfo = {
    name: data?.name || (isError ? 'Private server' : spaceId),
    avatarUrl: data?.avatar_url
      ? mxcUrlToHttp(mx, data.avatar_url, useAuthentication, 96, 96, 'crop') ?? undefined
      : undefined,
    topic: data?.topic,
    members: data?.num_joined_members,
  };
  return (
    <CardBody
      info={info}
      action={
        <Box direction="Column" gap="200">
          {error && (
            <Text size="T200" style={{ color: color.Critical.Main }}>
              {error}
            </Text>
          )}
          <Button
            variant="Success"
            radii="300"
            size="400"
            disabled={joining}
            onClick={join}
            before={joining && <Spinner size="100" variant="Success" fill="Solid" />}
          >
            <Text size="B400">Join</Text>
          </Button>
        </Box>
      }
    />
  );
}

type ServerTagCardProps = {
  anchor: RectCords;
  spaceId: string;
  // Whose tag was clicked; their server is a good route to join through.
  userId: string;
  onClose: () => void;
};
// Clicking someone's server tag shows that server, with a way in if you're not a member.
export function ServerTagCard({ anchor, spaceId, userId, onClose }: ServerTagCardProps) {
  const mx = useMatrixClient();
  const space = mx.getRoom(spaceId);
  const joined = space?.getMyMembership() === Membership.Join;
  const cardRef = useRef<HTMLDivElement>(null);
  return (
    <PopOut
      anchor={anchor}
      position="Top"
      align="Start"
      offset={6}
      content={
        <FocusTrap
          focusTrapOptions={{
            initialFocus: false,
            returnFocusOnDeactivate: false,
            // Nothing is focusable while it loads.
            fallbackFocus: () => cardRef.current ?? document.body,
            onDeactivate: onClose,
            clickOutsideDeactivates: true,
            escapeDeactivates: stopPropagation,
          }}
        >
          <Menu ref={cardRef} tabIndex={-1} style={{ padding: 0, overflow: 'hidden' }}>
            {joined && space ? (
              <JoinedServer space={space} onClose={onClose} />
            ) : (
              <OtherServer spaceId={spaceId} via={getMxIdServer(userId)} onClose={onClose} />
            )}
          </Menu>
        </FocusTrap>
      }
    />
  );
}

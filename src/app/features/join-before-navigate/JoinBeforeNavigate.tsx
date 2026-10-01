import React, { useEffect } from 'react';
import { Box, Icon, IconButton, Icons, Scroll, Text, toRem } from 'folds';
import { useAtomValue } from 'jotai';
import { RoomCard } from '../../components/room-card';
import { RoomTopicViewer } from '../../components/room-topic-viewer';
import { Page, PageHeader } from '../../components/page';
import { RoomSummaryLoader } from '../../components/RoomSummaryLoader';
import { useRoomNavigate } from '../../hooks/useRoomNavigate';
import { useMatrixClient } from '../../hooks/useMatrixClient';
import { allRoomsAtom } from '../../state/room-list/roomList';
import { ScreenSize, useScreenSizeContext } from '../../hooks/useScreenSize';
import { BackRouteHandler } from '../../components/BackRouteHandler';

// Recent auto-redirects per room, so two sections that disagree can't bounce the user forever.
const redirects = new Map<string, number[]>();

type JoinBeforeNavigateProps = { roomIdOrAlias: string; eventId?: string; viaServers?: string[] };
export function JoinBeforeNavigate({
  roomIdOrAlias,
  eventId,
  viaServers,
}: JoinBeforeNavigateProps) {
  const mx = useMatrixClient();
  const allRooms = useAtomValue(allRoomsAtom);
  const { navigateRoom, navigateSpace } = useRoomNavigate();
  const screenSize = useScreenSizeContext();

  const handleView = (roomId: string) => {
    if (mx.getRoom(roomId)?.isSpaceRoom()) {
      navigateSpace(roomId);
      return;
    }
    navigateRoom(roomId, eventId);
  };

  // Already joined but opened under the wrong section (e.g. a DM before m.direct synced): go there.
  const joinedId = allRooms.find(
    (id) => id === roomIdOrAlias || mx.getRoom(id)?.getCanonicalAlias() === roomIdOrAlias
  );
  useEffect(() => {
    if (!joinedId) return;
    const now = Date.now();
    const recent = (redirects.get(joinedId) ?? []).filter((t) => now - t < 5000);
    if (recent.length >= 3) return;
    redirects.set(joinedId, [...recent, now]);
    if (mx.getRoom(joinedId)?.isSpaceRoom()) navigateSpace(joinedId);
    else navigateRoom(joinedId, eventId, { replace: true });
  }, [mx, joinedId, eventId, navigateRoom, navigateSpace]);

  return (
    <Page>
      <PageHeader balance>
        <Box grow="Yes" gap="200">
          <Box shrink="No">
            {screenSize === ScreenSize.Mobile && (
              <BackRouteHandler>
                {(onBack) => (
                  <IconButton onClick={onBack}>
                    <Icon src={Icons.ArrowLeft} />
                  </IconButton>
                )}
              </BackRouteHandler>
            )}
          </Box>
          <Box grow="Yes" justifyContent="Center" alignItems="Center" gap="200">
            <Text size="H3" truncate>
              {roomIdOrAlias}
            </Text>
          </Box>
        </Box>
      </PageHeader>
      <Box grow="Yes">
        <Scroll hideTrack visibility="Hover" size="0">
          <Box style={{ height: '100%' }} grow="Yes" alignItems="Center" justifyContent="Center">
            <RoomSummaryLoader roomIdOrAlias={roomIdOrAlias}>
              {(summary) => (
                <RoomCard
                  style={{ maxWidth: toRem(364), width: '100%' }}
                  roomIdOrAlias={roomIdOrAlias}
                  allRooms={allRooms}
                  avatarUrl={summary?.avatar_url}
                  name={summary?.name}
                  topic={summary?.topic}
                  memberCount={summary?.num_joined_members}
                  roomType={summary?.room_type}
                  viaServers={viaServers}
                  renderTopicViewer={(name, topic, requestClose) => (
                    <RoomTopicViewer name={name} topic={topic} requestClose={requestClose} />
                  )}
                  onView={handleView}
                />
              )}
            </RoomSummaryLoader>
          </Box>
        </Scroll>
      </Box>
    </Page>
  );
}

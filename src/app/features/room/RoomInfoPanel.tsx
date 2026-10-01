import React, { useEffect, useRef, useState } from 'react';
import FocusTrap from 'focus-trap-react';
import {
  Avatar,
  Box,
  color,
  config,
  Icon,
  IconButton,
  Icons,
  Overlay,
  OverlayBackdrop,
  OverlayCenter,
  Scroll,
  Text,
  toRem,
} from 'folds';
import { Room } from 'matrix-js-sdk';
import classNames from 'classnames';
import { MembersDrawer } from './MembersDrawer';
import { ContainerColor } from '../../styles/ContainerColor.css';
import * as css from './RoomInfoPanel.css';
import { RoomAvatar, RoomIcon } from '../../components/room-avatar';
import { useMatrixClient } from '../../hooks/useMatrixClient';
import { useRoomMembers } from '../../hooks/useRoomMembers';
import { stopPropagation } from '../../utils/keyboard';
import { useRoomNavigate } from '../../hooks/useRoomNavigate';
import { InfoTab, InfoTabBar, InfoTabContent } from './RoomInfoTabs';

const INFO_STATE = 'angaaraRoomInfo';

type RoomInfoPanelProps = {
  room: Room;
  name: string;
  topic?: string;
  avatarUrl?: string;
  direct: boolean;
  requestClose: () => void;
  popup?: boolean;
};
export function RoomInfoPanel({
  room,
  name,
  topic,
  avatarUrl,
  direct,
  requestClose,
  popup,
}: RoomInfoPanelProps) {
  const mx = useMatrixClient();
  const members = useRoomMembers(mx, room.roomId);

  let kind = 'Room';
  if (direct) kind = 'Direct Message';
  else if (room.hasEncryptionStateEvent()) kind = 'Encrypted Room';

  const [tab, setTab] = useState<InfoTab>('members');
  const { navigateRoom } = useRoomNavigate();

  const closeRef = useRef(requestClose);
  closeRef.current = requestClose;
  useEffect(() => {
    window.history.pushState({ ...window.history.state, [INFO_STATE]: true }, '');
    const onPop = () => closeRef.current();
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);
  const close = () => {
    if (window.history.state?.[INFO_STATE]) window.history.back();
    else requestClose();
  };
  const jumpTo = (eventId: string) => {
    requestClose();
    navigateRoom(room.roomId, eventId, { replace: true });
  };

  const info = (
    <Box direction="Column" shrink="No" gap="300" style={{ padding: config.space.S200 }}>
      <IconButton
        onClick={close}
        variant="Background"
        aria-label={popup ? 'Close' : 'Back to chat'}
        style={{ alignSelf: popup ? 'flex-end' : 'flex-start' }}
      >
        <Icon src={popup ? Icons.Cross : Icons.ArrowLeft} />
      </IconButton>
      <Box direction="Column" gap="300" style={{ padding: `0 ${config.space.S200}` }}>
        <Box alignItems="Center" gap="300">
          <Avatar size="500" radii="400">
            <RoomAvatar
              roomId={room.roomId}
              src={avatarUrl}
              alt={name}
              renderFallback={() => (
                <RoomIcon size="400" joinRule={room.getJoinRule()} roomType={room.getType()} />
              )}
            />
          </Avatar>
          <Box direction="Column" style={{ minWidth: 0 }}>
            <Text size="H3" truncate>
              {name}
            </Text>
            <Text size="T300" priority="300">
              {kind}
            </Text>
          </Box>
        </Box>
        {topic && (
          <Text size="T300" priority="300" style={{ overflowWrap: 'anywhere' }}>
            {topic}
          </Text>
        )}
      </Box>
    </Box>
  );
  const tabBar = <InfoTabBar value={tab} onChange={setTab} />;

  const body = (
    <FocusTrap
      focusTrapOptions={{
        initialFocus: false,
        onDeactivate: close,
        clickOutsideDeactivates: popup,
        escapeDeactivates: stopPropagation,
      }}
    >
      <Box
        className={classNames(ContainerColor({ variant: 'Background' }), css.Panel)}
        data-theme-wash
        style={{
          ...(popup
            ? {
                position: 'relative',
                width: `min(${toRem(820)}, 92vw)`,
                height: '86vh',
                borderRadius: config.radii.R500,
                overflow: 'hidden',
                boxShadow: config.shadow.E400,
              }
            : { position: 'fixed', inset: 0 }),
          backgroundColor: color.Background.Container,
          color: color.Background.OnContainer,
        }}
      >
        {tab === 'members' ? (
          <MembersDrawer
            room={room}
            members={members}
            pageHeader={
              <>
                {info}
                {tabBar}
              </>
            }
          />
        ) : (
          <Scroll variant="Background" size="0" hideTrack>
            {/* Same spacing as the members list, so switching tabs doesn't shift the header. */}
            <Box direction="Column" gap="200" style={{ padding: `${config.space.S200} 0` }}>
              {info}
              {tabBar}
              <InfoTabContent room={room} tab={tab} onJump={jumpTo} onClose={close} wide={popup} />
            </Box>
          </Scroll>
        )}
      </Box>
    </FocusTrap>
  );

  return (
    <Overlay open backdrop={popup ? <OverlayBackdrop /> : undefined}>
      {popup ? <OverlayCenter>{body}</OverlayCenter> : body}
    </Overlay>
  );
}

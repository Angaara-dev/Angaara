import React, { useEffect, useRef, useState } from 'react';
import { color, config, Menu, Overlay, OverlayBackdrop, OverlayCenter, PopOut, toRem } from 'folds';
import FocusTrap from 'focus-trap-react';
import { useCloseUserRoomProfile, useUserRoomProfileState } from '../state/hooks/userRoomProfile';
import { UserRoomProfile } from './user-profile';
import { UserRoomProfileState } from '../state/userRoomProfile';
import { useAllJoinedRoomsSet, useGetRoom } from '../hooks/useGetRoom';
import { stopPropagation } from '../utils/keyboard';
import { SpaceProvider } from '../hooks/useSpace';
import { RoomProvider } from '../hooks/useRoom';
import { usePhone } from '../hooks/useScreenSize';
import { BottomSheet } from './bottom-sheet';

function UserRoomProfileContextMenu({ state }: { state: UserRoomProfileState }) {
  const { roomId, spaceId, userId, cords, position } = state;
  const allJoinedRooms = useAllJoinedRoomsSet();
  const getRoom = useGetRoom(allJoinedRooms);
  const room = getRoom(roomId);
  const space = spaceId ? getRoom(spaceId) : undefined;

  const close = useCloseUserRoomProfile();
  const phone = usePhone();
  const [full, setFull] = useState(false);
  // Swapping the small card for the full panel drops its focus trap, which must not close both.
  const openingFull = useRef(false);

  const onOpener = (evt: MouseEvent | TouchEvent) => {
    const point = 'changedTouches' in evt ? evt.changedTouches[0] : evt;
    if (!point || !cords.width) return false;
    const { clientX: x, clientY: y } = point;
    return (
      x >= cords.x && x <= cords.x + cords.width && y >= cords.y && y <= cords.y + cords.height
    );
  };
  // The card is open while this is mounted, so a tap on its opener closes it (and isn't
  // passed on, or the opener would just reopen it).
  useEffect(() => {
    const onClick = (evt: MouseEvent) => {
      if (!onOpener(evt)) return;
      evt.preventDefault();
      evt.stopPropagation();
      close();
    };
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  });

  if (!room) return null;

  const profile = (compact: boolean) => (
    <SpaceProvider value={space ?? null}>
      <RoomProvider value={room}>
        <UserRoomProfile
          userId={userId}
          onViewFull={
            compact
              ? () => {
                  openingFull.current = true;
                  setFull(true);
                }
              : undefined
          }
        />
      </RoomProvider>
    </SpaceProvider>
  );

  if (phone) {
    return (
      <BottomSheet open onClose={close} label="Profile" floatingHandle>
        <div data-plain-theme style={{ overflowY: 'auto', minHeight: 0 }}>
          {profile(false)}
        </div>
      </BottomSheet>
    );
  }

  if (full) {
    return (
      <Overlay open backdrop={<OverlayBackdrop />}>
        <OverlayCenter>
          <FocusTrap
            focusTrapOptions={{
              initialFocus: false,
              onDeactivate: close,
              clickOutsideDeactivates: true,
              escapeDeactivates: stopPropagation,
            }}
          >
            <div
              data-plain-theme
              style={{
                width: `min(${toRem(480)}, calc(100vw - ${toRem(32)}))`,
                maxHeight: `calc(100vh - ${toRem(64)})`,
                overflowY: 'auto',
                borderRadius: config.radii.R500,
                background: color.Surface.Container,
                boxShadow: config.shadow.E300,
              }}
            >
              {profile(false)}
            </div>
          </FocusTrap>
        </OverlayCenter>
      </Overlay>
    );
  }

  return (
    <PopOut
      anchor={cords}
      position={position ?? 'Top'}
      align="Start"
      content={
        <FocusTrap
          focusTrapOptions={{
            initialFocus: false,
            onDeactivate: () => {
              if (!openingFull.current) close();
            },
            clickOutsideDeactivates: (evt: MouseEvent | TouchEvent) => !onOpener(evt),
            allowOutsideClick: (evt: MouseEvent | TouchEvent) => onOpener(evt),
            escapeDeactivates: stopPropagation,
          }}
        >
          <Menu
            data-plain-theme
            style={{
              width: `min(${toRem(260)}, calc(100vw - ${toRem(24)}))`,
              maxHeight: `calc(100vh - ${toRem(32)})`,
              overflowY: 'auto',
            }}
          >
            {profile(true)}
          </Menu>
        </FocusTrap>
      }
    />
  );
}

export function UserRoomProfileRenderer() {
  const state = useUserRoomProfileState();

  if (!state) return null;
  return <UserRoomProfileContextMenu key={`${state.roomId}${state.userId}`} state={state} />;
}

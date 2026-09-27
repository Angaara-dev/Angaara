import React, { useEffect } from 'react';
import { Menu, PopOut, toRem } from 'folds';
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

  // Whether a tap landed on the name or avatar that opened the card.
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

  const profile = (
    <SpaceProvider value={space ?? null}>
      <RoomProvider value={room}>
        <UserRoomProfile userId={userId} />
      </RoomProvider>
    </SpaceProvider>
  );

  // Phones get a full-width sheet from the bottom instead of a floating card.
  if (phone) {
    return (
      <BottomSheet open onClose={close} label="Profile" floatingHandle>
        <div style={{ overflowY: 'auto', minHeight: 0 }}>{profile}</div>
      </BottomSheet>
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
            onDeactivate: close,
            clickOutsideDeactivates: (evt: MouseEvent | TouchEvent) => !onOpener(evt),
            allowOutsideClick: (evt: MouseEvent | TouchEvent) => onOpener(evt),
            escapeDeactivates: stopPropagation,
          }}
        >
          <Menu
            style={{
              width: `min(${toRem(340)}, calc(100vw - ${toRem(24)}))`,
              maxHeight: `calc(100vh - ${toRem(32)})`,
              overflowY: 'auto',
            }}
          >
            {profile}
          </Menu>
        </FocusTrap>
      }
    />
  );
}

export function UserRoomProfileRenderer() {
  const state = useUserRoomProfileState();

  if (!state) return null;
  return <UserRoomProfileContextMenu state={state} />;
}

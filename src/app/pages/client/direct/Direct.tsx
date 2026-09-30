import React, { MouseEventHandler, forwardRef, useMemo, useRef, useState } from 'react';
import { useAtom, useAtomValue } from 'jotai';
import {
  Avatar,
  Box,
  Button,
  Icon,
  IconButton,
  Icons,
  Menu,
  MenuItem,
  PopOut,
  RectCords,
  Text,
  config,
  toRem,
} from 'folds';
import { useVirtualizer } from '@tanstack/react-virtual';
import FocusTrap from 'focus-trap-react';
import { useNavigate } from 'react-router-dom';
import { useMatrixClient } from '../../../hooks/useMatrixClient';
import { factoryRoomIdByActivity } from '../../../utils/sort';
import {
  NavButton,
  NavCategory,
  NavCategoryHeader,
  NavEmptyCenter,
  NavEmptyLayout,
  NavItem,
  NavItemContent,
} from '../../../components/nav';
import { getDirectCreatePath, getDirectFriendsPath, getDirectRoomPath } from '../../pathUtils';
import { getCanonicalAliasOrRoomId } from '../../../utils/matrix';
import { VirtualTile } from '../../../components/virtualizer';
import { RoomNavCategoryButton, RoomNavItem } from '../../../features/room-nav';
import { makeNavCategoryId } from '../../../state/closedNavCategories';
import { roomToUnreadAtom } from '../../../state/room/roomToUnread';
import { useCategoryHandler } from '../../../hooks/useCategoryHandler';
import { useNavToActivePathMapper } from '../../../hooks/useNavToActivePathMapper';
import { useDirectRooms } from './useDirectRooms';
import { PageNav, PageNavContent, PageNavHeader } from '../../../components/page';
import { useClosedNavCategoriesAtom } from '../../../state/hooks/closedNavCategories';
import { useRoomsUnread } from '../../../state/hooks/unread';
import { markAsRead } from '../../../utils/notifications';
import { stopPropagation } from '../../../utils/keyboard';
import {
  getRoomNotificationMode,
  useRoomsNotificationPreferencesContext,
} from '../../../hooks/useRoomsNotificationPreferences';
import {
  useDirectCreateSelected,
  useDirectFriendsSelected,
} from '../../../hooks/router/useDirectSelected';
import { useIncomingRequests } from '../../../hooks/useFriends';
import { UnreadBadge, UnreadBadgeCenter } from '../../../components/unread-badge';
import { UserPanel } from '../UserPanel';
import { useStickySelectedRoom } from '../../../hooks/router/useStickySelectedRoom';
import { useAccountData } from '../../../hooks/useAccountData';
import { XP_ROOM_KEY } from '../../../../client/xp';
import { BRAND_NAME } from '../../../brand';
import { useHideActivity } from '../../../hooks/useActivityStatus';

type DirectMenuProps = {
  requestClose: () => void;
};
const DirectMenu = forwardRef<HTMLDivElement, DirectMenuProps>(({ requestClose }, ref) => {
  const mx = useMatrixClient();
  const hideActivity = useHideActivity();
  const orphanRooms = useDirectRooms();
  const unread = useRoomsUnread(orphanRooms, roomToUnreadAtom);

  const handleMarkAsRead = () => {
    if (!unread) return;
    orphanRooms.forEach((rId) => markAsRead(mx, rId, hideActivity));
    requestClose();
  };

  return (
    <Menu ref={ref} style={{ maxWidth: toRem(160), width: '100vw' }}>
      <Box direction="Column" gap="100" style={{ padding: config.space.S100 }}>
        <MenuItem
          onClick={handleMarkAsRead}
          size="300"
          after={<Icon size="100" src={Icons.CheckTwice} />}
          radii="300"
          aria-disabled={!unread}
        >
          <Text style={{ flexGrow: 1 }} as="span" size="T300" truncate>
            Mark as Read
          </Text>
        </MenuItem>
      </Box>
    </Menu>
  );
});

function DirectHeader() {
  const [menuAnchor, setMenuAnchor] = useState<RectCords>();

  const handleOpenMenu: MouseEventHandler<HTMLButtonElement> = (evt) => {
    const cords = evt.currentTarget.getBoundingClientRect();
    setMenuAnchor((currentState) => {
      if (currentState) return undefined;
      return cords;
    });
  };

  return (
    <>
      <PageNavHeader>
        <Box alignItems="Center" grow="Yes" gap="300">
          <Box grow="Yes">
            <Text size="H4" truncate>
              Direct Messages
            </Text>
          </Box>
          <Box>
            <IconButton aria-pressed={!!menuAnchor} variant="Background" onClick={handleOpenMenu}>
              <Icon src={Icons.VerticalDots} size="200" />
            </IconButton>
          </Box>
        </Box>
      </PageNavHeader>
      <PopOut
        anchor={menuAnchor}
        position="Bottom"
        align="End"
        offset={6}
        content={
          <FocusTrap
            focusTrapOptions={{
              initialFocus: false,
              returnFocusOnDeactivate: false,
              onDeactivate: () => setMenuAnchor(undefined),
              clickOutsideDeactivates: true,
              isKeyForward: (evt: KeyboardEvent) => evt.key === 'ArrowDown',
              isKeyBackward: (evt: KeyboardEvent) => evt.key === 'ArrowUp',
              escapeDeactivates: stopPropagation,
            }}
          >
            <DirectMenu requestClose={() => setMenuAnchor(undefined)} />
          </FocusTrap>
        }
      />
    </>
  );
}

function FriendsNavItem() {
  const navigate = useNavigate();
  const selected = useDirectFriendsSelected();
  const incoming = useIncomingRequests();

  return (
    <NavItem variant="Background" radii="400" aria-selected={selected}>
      <NavButton onClick={() => navigate(getDirectFriendsPath())}>
        <NavItemContent>
          <Box as="span" grow="Yes" alignItems="Center" gap="200">
            <Avatar size="200" radii="400">
              <Icon src={Icons.User} size="100" filled={selected} />
            </Avatar>
            <Box as="span" grow="Yes">
              <Text as="span" size="Inherit" truncate>
                Friends
              </Text>
            </Box>
            {incoming.length > 0 && (
              <UnreadBadgeCenter>
                <UnreadBadge highlight count={incoming.length} />
              </UnreadBadgeCenter>
            )}
          </Box>
        </NavItemContent>
      </NavButton>
    </NavItem>
  );
}

function DirectEmpty() {
  const navigate = useNavigate();

  return (
    <NavEmptyCenter>
      <NavEmptyLayout
        icon={<Icon size="600" src={Icons.Mention} />}
        title={
          <Text size="H5" align="Center">
            No Direct Messages
          </Text>
        }
        content={
          <Text size="T300" align="Center">
            You do not have any direct messages yet.
          </Text>
        }
        options={
          <Box direction="Column" gap="200">
            <Button variant="Secondary" size="300" onClick={() => navigate(getDirectCreatePath())}>
              <Text size="B300" truncate>
                Direct Message
              </Text>
            </Button>
            <Button
              variant="Secondary"
              fill="Soft"
              size="300"
              onClick={() => navigate(getDirectFriendsPath())}
            >
              <Text size="B300" truncate>
                Friends
              </Text>
            </Button>
          </Box>
        }
      />
    </NavEmptyCenter>
  );
}

const DEFAULT_CATEGORY_ID = makeNavCategoryId('direct', 'direct');
const BOT_CATEGORY_ID = makeNavCategoryId('direct', 'angaara');
export function Direct() {
  const mx = useMatrixClient();
  useNavToActivePathMapper('direct');
  const scrollRef = useRef<HTMLDivElement>(null);
  const directs = useDirectRooms();
  const notificationPreferences = useRoomsNotificationPreferencesContext();
  const roomToUnread = useAtomValue(roomToUnreadAtom);
  const navigate = useNavigate();

  const createDirectSelected = useDirectCreateSelected();

  const selectedRoomId = useStickySelectedRoom('direct', createDirectSelected);
  const noRoomToDisplay = directs.length === 0;
  const [closedCategories, setClosedCategories] = useAtom(useClosedNavCategoriesAtom());

  const botRoomId = useAccountData(XP_ROOM_KEY)?.getContent()?.room_id as string | undefined;
  const botRoom = botRoomId && directs.includes(botRoomId) ? mx.getRoom(botRoomId) : undefined;
  const showBotRoom =
    !!botRoom &&
    (!closedCategories.has(BOT_CATEGORY_ID) ||
      roomToUnread.has(botRoom.roomId) ||
      botRoom.roomId === selectedRoomId);

  const sortedDirects = useMemo(() => {
    const items = Array.from(directs)
      .filter((rId) => rId !== botRoomId)
      .sort(factoryRoomIdByActivity(mx));
    if (closedCategories.has(DEFAULT_CATEGORY_ID)) {
      return items.filter((rId) => roomToUnread.has(rId) || rId === selectedRoomId);
    }
    return items;
  }, [mx, directs, botRoomId, closedCategories, roomToUnread, selectedRoomId]);

  const virtualizer = useVirtualizer({
    count: sortedDirects.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 38,
    overscan: 10,
  });

  const handleCategoryClick = useCategoryHandler(setClosedCategories, (categoryId) =>
    closedCategories.has(categoryId)
  );

  return (
    <PageNav>
      <DirectHeader />
      {noRoomToDisplay ? (
        <DirectEmpty />
      ) : (
        <PageNavContent scrollRef={scrollRef}>
          <Box direction="Column" gap="300">
            <NavCategory>
              <FriendsNavItem />
              <NavItem variant="Background" radii="400" aria-selected={createDirectSelected}>
                <NavButton onClick={() => navigate(getDirectCreatePath())}>
                  <NavItemContent>
                    <Box as="span" grow="Yes" alignItems="Center" gap="200">
                      <Avatar size="200" radii="400">
                        <Icon src={Icons.Plus} size="100" />
                      </Avatar>
                      <Box as="span" grow="Yes">
                        <Text as="span" size="Inherit" truncate>
                          Create Chat
                        </Text>
                      </Box>
                    </Box>
                  </NavItemContent>
                </NavButton>
              </NavItem>
            </NavCategory>
            {botRoom && (
              <NavCategory>
                <NavCategoryHeader>
                  <RoomNavCategoryButton
                    closed={closedCategories.has(BOT_CATEGORY_ID)}
                    data-category-id={BOT_CATEGORY_ID}
                    onClick={handleCategoryClick}
                  >
                    {BRAND_NAME}
                  </RoomNavCategoryButton>
                </NavCategoryHeader>
                {showBotRoom && (
                  <RoomNavItem
                    room={botRoom}
                    selected={selectedRoomId === botRoom.roomId}
                    showAvatar
                    direct
                    linkPath={getDirectRoomPath(getCanonicalAliasOrRoomId(mx, botRoom.roomId))}
                    notificationMode={getRoomNotificationMode(
                      notificationPreferences,
                      botRoom.roomId
                    )}
                  />
                )}
              </NavCategory>
            )}
            <NavCategory>
              <NavCategoryHeader>
                <RoomNavCategoryButton
                  closed={closedCategories.has(DEFAULT_CATEGORY_ID)}
                  data-category-id={DEFAULT_CATEGORY_ID}
                  onClick={handleCategoryClick}
                >
                  Chats
                </RoomNavCategoryButton>
              </NavCategoryHeader>
              <div
                style={{
                  position: 'relative',
                  height: virtualizer.getTotalSize(),
                }}
              >
                {virtualizer.getVirtualItems().map((vItem) => {
                  const roomId = sortedDirects[vItem.index];
                  const room = mx.getRoom(roomId);
                  if (!room) return null;
                  const selected = selectedRoomId === roomId;

                  return (
                    <VirtualTile
                      virtualItem={vItem}
                      key={vItem.index}
                      ref={virtualizer.measureElement}
                    >
                      <RoomNavItem
                        room={room}
                        selected={selected}
                        showAvatar
                        direct
                        linkPath={getDirectRoomPath(getCanonicalAliasOrRoomId(mx, roomId))}
                        notificationMode={getRoomNotificationMode(
                          notificationPreferences,
                          room.roomId
                        )}
                      />
                    </VirtualTile>
                  );
                })}
              </div>
            </NavCategory>
          </Box>
        </PageNavContent>
      )}
      <UserPanel />
    </PageNav>
  );
}

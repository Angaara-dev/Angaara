import React, {
  ChangeEventHandler,
  MouseEventHandler,
  ReactNode,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Avatar,
  Badge,
  Box,
  Chip,
  Header,
  Icon,
  IconButton,
  Icons,
  Input,
  MenuItem,
  PopOut,
  RectCords,
  Scroll,
  Spinner,
  Text,
  Tooltip,
  TooltipProvider,
  config,
  toRem,
} from 'folds';
import { MatrixClient, Room, RoomMember } from 'matrix-js-sdk';
import { useVirtualizer } from '@tanstack/react-virtual';
import classNames from 'classnames';

import * as css from './MembersDrawer.css';
import { useMatrixClient } from '../../hooks/useMatrixClient';
import { UseStateProvider } from '../../components/UseStateProvider';
import {
  SearchItemStrGetter,
  UseAsyncSearchOptions,
  useAsyncSearch,
} from '../../hooks/useAsyncSearch';
import { useDebounce } from '../../hooks/useDebounce';
import { TypingIndicator } from '../../components/typing-indicator';
import { getMemberDisplayName, getMemberSearchStr } from '../../utils/room';
import { getMxIdLocalPart } from '../../utils/matrix';
import { useSetSetting, useSetting } from '../../state/hooks/settings';
import { settingsAtom } from '../../state/settings';
import { millify } from '../../plugins/millify';
import { ScrollTopContainer } from '../../components/scroll-top-container';
import { UserAvatar } from '../../components/user-avatar';
import { useRoomTypingMember } from '../../hooks/useRoomTypingMembers';
import { useMediaAuthentication } from '../../hooks/useMediaAuthentication';
import { useMembershipFilter, useMembershipFilterMenu } from '../../hooks/useMemberFilter';
import { useMemberPowerSort, useMemberSort, useMemberSortMenu } from '../../hooks/useMemberSort';
import { useGetMemberPowerLevel, usePowerLevelsContext } from '../../hooks/usePowerLevels';
import { MembershipFilterMenu } from '../../components/MembershipFilterMenu';
import { MemberSortMenu } from '../../components/MemberSortMenu';
import { useOpenUserRoomProfile, useUserRoomProfileState } from '../../state/hooks/userRoomProfile';
import { useSpaceOptionally } from '../../hooks/useSpace';
import { ContainerColor } from '../../styles/ContainerColor.css';
import {
  useAccessiblePowerTagColors,
  useFlattenPowerTagMembers,
  useGetMemberPowerTag,
} from '../../hooks/useMemberPowerTag';
import { useRoomCreators } from '../../hooks/useRoomCreators';
import { useUserStatus } from '../../hooks/useUserStatus';
import { UserBadges } from '../../components/user-profile/UserBadges';
import { ServerTagBadge } from '../../components/user-profile/ServerTagBadge';
import { useUserPanelBgUrl } from '../../hooks/useUserBanner';
import { useRoomCreatorsTag } from '../../hooks/useRoomCreatorsTag';
import { usePowerLevelTags } from '../../hooks/usePowerLevelTags';
import { useTheme } from '../../hooks/useTheme';
import { useActivityStatus } from '../../hooks/useActivityStatus';
import { AvatarPresence, StatusIcon } from '../../components/presence';
import colorMXID from '../../../util/colorMXID';
import { roleNameStyle } from '../../components/power';
import { MemberContextMenu } from './MemberContextMenu';

type MemberDrawerHeaderProps = {
  room: Room;
};
function MemberDrawerHeader({ room }: MemberDrawerHeaderProps) {
  const setPeopleDrawer = useSetSetting(settingsAtom, 'isPeopleDrawer');

  return (
    <Header className={css.MembersDrawerHeader} variant="Background" size="600">
      <Box grow="Yes" alignItems="Center" gap="200">
        <Box grow="Yes" alignItems="Center" gap="200">
          <Text title={`${room.getJoinedMemberCount()} Members`} size="H5" truncate>
            {`${millify(room.getJoinedMemberCount())} Members`}
          </Text>
        </Box>
        <Box shrink="No" alignItems="Center">
          <TooltipProvider
            position="Bottom"
            align="End"
            offset={4}
            tooltip={
              <Tooltip>
                <Text>Close</Text>
              </Tooltip>
            }
          >
            {(triggerRef) => (
              <IconButton
                ref={triggerRef}
                variant="Background"
                onClick={() => setPeopleDrawer(false)}
              >
                <Icon src={Icons.Cross} />
              </IconButton>
            )}
          </TooltipProvider>
        </Box>
      </Box>
    </Header>
  );
}

type MemberItemProps = {
  mx: MatrixClient;
  useAuthentication: boolean;
  room: Room;
  member: RoomMember;
  onClick: MouseEventHandler<HTMLButtonElement>;
  onContextMenu: MouseEventHandler<HTMLButtonElement>;
  pressed?: boolean;
  typing?: boolean;
  large?: boolean;
  nameColor?: string;
  nameGradient?: string;
};
function MemberItem({
  mx,
  useAuthentication,
  room,
  member,
  onClick,
  onContextMenu,
  pressed,
  typing,
  large,
  nameColor,
  nameGradient,
}: MemberItemProps) {
  const name =
    getMemberDisplayName(room, member.userId) ?? getMxIdLocalPart(member.userId) ?? member.userId;
  const avatarMxcUrl = member.getMxcAvatarUrl();
  const avatarUrl = avatarMxcUrl
    ? mx.mxcUrlToHttp(avatarMxcUrl, 100, 100, 'crop', undefined, false, useAuthentication)
    : undefined;

  // Only fetch statuses for rows that stay on screen, so fast scrolling doesn't flood the server.
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setSettled(true), 300);
    return () => clearTimeout(timer);
  }, []);
  const status = useUserStatus(member.userId, settled);
  const panelBg = useUserPanelBgUrl(member.userId, settled);
  const activity = useActivityStatus(member.userId, settled);
  const offline = activity === 'offline';

  return (
    <MenuItem
      className={css.MemberRow}
      style={{
        padding: `0 ${large ? config.space.S400 : config.space.S200}`,
        minHeight: toRem(large ? 60 : 40),
        opacity: offline && !pressed ? 0.45 : undefined,
      }}
      radii={large ? '0' : '400'}
      aria-pressed={pressed}
      data-user-id={member.userId}
      data-has-bg={!!panelBg}
      variant={large ? 'Surface' : 'Background'}
      onClick={onClick}
      onContextMenu={onContextMenu}
      before={
        <AvatarPresence
          variant={large ? 'Surface' : 'Background'}
          badge={activity && <StatusIcon status={activity} size={large ? 12 : 10} />}
        >
          <Avatar
            size={large ? '400' : '300'}
            radii="Pill"
            style={large ? { width: toRem(34), height: toRem(34) } : undefined}
          >
            <UserAvatar
              userId={member.userId}
              src={avatarUrl ?? undefined}
              alt={name}
              renderFallback={() => <Icon size="100" src={Icons.User} filled />}
            />
          </Avatar>
        </AvatarPresence>
      }
      after={
        typing && (
          <Badge size="300" variant="Secondary" fill="Soft" radii="Pill" outlined>
            <TypingIndicator size="300" />
          </Badge>
        )
      }
    >
      <Box grow="Yes" direction="Column" style={{ minWidth: 0 }}>
        {panelBg && (
          <img
            className={css.MemberBg}
            src={panelBg}
            alt=""
            onError={(evt) => {
              // eslint-disable-next-line no-param-reassign
              evt.currentTarget.style.display = 'none';
            }}
          />
        )}
        <Box alignItems="Center" gap="100">
          <Text
            size={large ? 'T400' : 'T300'}
            truncate
            style={{
              ...roleNameStyle(nameColor, nameGradient),
              fontWeight: nameColor ? 500 : undefined,
            }}
          >
            {name}
          </Text>
          <ServerTagBadge userId={member.userId} enabled={settled} />
          <UserBadges userId={member.userId} size="small" />
        </Box>
        {status && (
          <Text size="T200" priority="300" truncate>
            {status}
          </Text>
        )}
      </Box>
    </MenuItem>
  );
}

const SEARCH_OPTIONS: UseAsyncSearchOptions = {
  limit: 1000,
  matchOptions: {
    contain: true,
  },
};

const isMember = (item: unknown): item is RoomMember =>
  typeof item === 'object' && item !== null && 'userId' in item;

const mxIdToName = (mxId: string) => getMxIdLocalPart(mxId) ?? mxId;
const getRoomMemberStr: SearchItemStrGetter<RoomMember> = (m, query) =>
  getMemberSearchStr(m, query, mxIdToName);

type MembersDrawerProps = {
  room: Room;
  members: RoomMember[];
  pageHeader?: ReactNode;
};
export function MembersDrawer({ room, members, pageHeader }: MembersDrawerProps) {
  const page = pageHeader !== undefined;
  const mx = useMatrixClient();
  const useAuthentication = useMediaAuthentication();
  const scrollRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const scrollTopAnchorRef = useRef<HTMLDivElement>(null);
  const powerLevels = usePowerLevelsContext();
  const creators = useRoomCreators(room);
  const getPowerTag = useGetMemberPowerTag(room, creators, powerLevels);
  const theme = useTheme();
  const creatorsTag = useRoomCreatorsTag();
  const powerLevelTags = usePowerLevelTags(room, powerLevels);
  const tagColors = useAccessiblePowerTagColors(theme.kind, creatorsTag, powerLevelTags);
  const [legacyUsernameColor] = useSetting(settingsAtom, 'legacyUsernameColor');
  const nameColorOf = (userId: string): string | undefined => {
    if (legacyUsernameColor) return colorMXID(userId);
    const tagColor = getPowerTag(userId).color;
    return tagColor ? tagColors.get(tagColor) : undefined;
  };
  const nameGradientOf = (userId: string): string | undefined => {
    const { gradient } = getPowerTag(userId);
    return !legacyUsernameColor && gradient ? tagColors.get(gradient) : undefined;
  };
  const getPowerLevel = useGetMemberPowerLevel(powerLevels);

  const fetchingMembers = members.length < room.getJoinedMemberCount();
  const openUserRoomProfile = useOpenUserRoomProfile();
  const space = useSpaceOptionally();
  const openProfileUserId = useUserRoomProfileState()?.userId;

  const membershipFilterMenu = useMembershipFilterMenu();
  const sortFilterMenu = useMemberSortMenu();
  const [sortFilterIndex, setSortFilterIndex] = useSetting(settingsAtom, 'memberSortFilterIndex');
  const [membershipFilterIndex, setMembershipFilterIndex] = useState(0);

  const membershipFilter = useMembershipFilter(membershipFilterIndex, membershipFilterMenu);
  const memberSort = useMemberSort(sortFilterIndex, sortFilterMenu);
  const memberPowerSort = useMemberPowerSort(creators, getPowerLevel);

  const typingMembers = useRoomTypingMember(room.roomId);

  const filteredMembers = useMemo(
    () => members.filter(membershipFilter.filterFn).sort(memberSort.sortFn).sort(memberPowerSort),
    [members, membershipFilter, memberSort, memberPowerSort]
  );

  const [result, search, resetSearch] = useAsyncSearch(
    filteredMembers,
    getRoomMemberStr,
    SEARCH_OPTIONS
  );
  if (!result && searchInputRef.current?.value) search(searchInputRef.current.value);

  const processMembers = result ? result.items : filteredMembers;

  const PLTagOrRoomMember = useFlattenPowerTagMembers(processMembers, getPowerTag);
  const groupCounts = useMemo(() => {
    const counts = new Map<unknown, number>();
    let tag: unknown;
    PLTagOrRoomMember.forEach((item) => {
      if ('userId' in item) counts.set(tag, (counts.get(tag) ?? 0) + 1);
      else tag = item;
    });
    return counts;
  }, [PLTagOrRoomMember]);

  const listRef = useRef<HTMLDivElement>(null);
  const [listOffset, setListOffset] = useState(0);
  useLayoutEffect(() => {
    const scroller = scrollRef.current;
    const list = listRef.current;
    if (!scroller || !list) return undefined;
    const measure = () =>
      setListOffset(
        list.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop
      );
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(list.parentElement ?? list);
    if (scroller.firstElementChild) observer.observe(scroller.firstElementChild);
    return () => observer.disconnect();
  }, []);

  const virtualizer = useVirtualizer({
    count: PLTagOrRoomMember.length,
    getScrollElement: () => scrollRef.current,
    scrollMargin: listOffset,
    estimateSize: () => (page ? 60 : 42),
    overscan: 10,
  });

  const handleSearchChange: ChangeEventHandler<HTMLInputElement> = useDebounce(
    useCallback(
      (evt) => {
        if (evt.target.value) search(evt.target.value);
        else resetSearch();
      },
      [search, resetSearch]
    ),
    { wait: 200 }
  );

  const handleMemberClick: MouseEventHandler<HTMLButtonElement> = (evt) => {
    const btn = evt.currentTarget as HTMLButtonElement;
    const userId = btn.getAttribute('data-user-id');
    if (!userId) return;
    openUserRoomProfile(room.roomId, space?.roomId, userId, btn.getBoundingClientRect(), 'Left');
  };

  const [memberMenu, setMemberMenu] = useState<{ userId: string; anchor: RectCords }>();
  const handleMemberContextMenu: MouseEventHandler<HTMLButtonElement> = (evt) => {
    const userId = evt.currentTarget.getAttribute('data-user-id');
    if (!userId) return;
    evt.preventDefault();
    setMemberMenu({ userId, anchor: { x: evt.clientX, y: evt.clientY, width: 0, height: 0 } });
  };

  return (
    <Box
      className={classNames(
        page ? css.MembersPage : css.MembersDrawer,
        ContainerColor({ variant: 'Background' })
      )}
      shrink="No"
      direction="Column"
    >
      {!page && <MemberDrawerHeader room={room} />}
      <Box className={css.MemberDrawerContentBase} grow="Yes">
        <Scroll
          ref={scrollRef}
          variant="Background"
          size={page ? '0' : '300'}
          visibility="Hover"
          hideTrack
        >
          <Box className={css.MemberDrawerContent} direction="Column" gap="200">
            {page && pageHeader}
            <Box
              ref={scrollTopAnchorRef}
              className={css.DrawerGroup}
              style={page ? { padding: `0 ${config.space.S400}` } : undefined}
              direction="Column"
              gap="200"
            >
              <Box alignItems="Center" justifyContent="SpaceBetween" gap="200">
                <UseStateProvider initial={undefined}>
                  {(anchor: RectCords | undefined, setAnchor) => (
                    <PopOut
                      anchor={anchor}
                      position="Bottom"
                      align="Start"
                      offset={4}
                      content={
                        <MembershipFilterMenu
                          selected={membershipFilterIndex}
                          onSelect={setMembershipFilterIndex}
                          requestClose={() => setAnchor(undefined)}
                        />
                      }
                    >
                      <Chip
                        onClick={
                          ((evt) =>
                            setAnchor(
                              evt.currentTarget.getBoundingClientRect()
                            )) as MouseEventHandler<HTMLButtonElement>
                        }
                        variant="Background"
                        size="400"
                        radii="300"
                        before={<Icon src={Icons.Filter} size="50" />}
                      >
                        <Text size="T200">{membershipFilter.name}</Text>
                      </Chip>
                    </PopOut>
                  )}
                </UseStateProvider>
                <UseStateProvider initial={undefined}>
                  {(anchor: RectCords | undefined, setAnchor) => (
                    <PopOut
                      anchor={anchor}
                      position="Bottom"
                      align="End"
                      offset={4}
                      content={
                        <MemberSortMenu
                          selected={sortFilterIndex}
                          onSelect={setSortFilterIndex}
                          requestClose={() => setAnchor(undefined)}
                        />
                      }
                    >
                      <Chip
                        onClick={
                          ((evt) =>
                            setAnchor(
                              evt.currentTarget.getBoundingClientRect()
                            )) as MouseEventHandler<HTMLButtonElement>
                        }
                        variant="Background"
                        size="400"
                        radii="300"
                        after={<Icon src={Icons.Sort} size="50" />}
                      >
                        <Text size="T200">{memberSort.name}</Text>
                      </Chip>
                    </PopOut>
                  )}
                </UseStateProvider>
              </Box>
              <Box direction="Column" gap="100">
                <Input
                  ref={searchInputRef}
                  onChange={handleSearchChange}
                  style={{ paddingRight: config.space.S200 }}
                  placeholder="Type name..."
                  variant="Surface"
                  size="400"
                  radii="400"
                  before={<Icon size="50" src={Icons.Search} />}
                  after={
                    result && (
                      <Chip
                        variant={result.items.length > 0 ? 'Success' : 'Critical'}
                        size="400"
                        radii="Pill"
                        aria-pressed
                        onClick={() => {
                          if (searchInputRef.current) {
                            searchInputRef.current.value = '';
                            searchInputRef.current.focus();
                          }
                          resetSearch();
                        }}
                        after={<Icon size="50" src={Icons.Cross} />}
                      >
                        <Text size="B300">{`${result.items.length || 'No'} ${
                          result.items.length === 1 ? 'Result' : 'Results'
                        }`}</Text>
                      </Chip>
                    )
                  }
                />
              </Box>
            </Box>

            <ScrollTopContainer scrollRef={scrollRef} anchorRef={scrollTopAnchorRef}>
              <IconButton
                onClick={() => virtualizer.scrollToOffset(0)}
                variant="Surface"
                radii="Pill"
                outlined
                size="300"
                aria-label="Scroll to Top"
              >
                <Icon src={Icons.ChevronTop} size="300" />
              </IconButton>
            </ScrollTopContainer>

            {!fetchingMembers && !result && processMembers.length === 0 && (
              <Text style={{ padding: config.space.S300 }} align="Center">
                {`No "${membershipFilter.name}" Members`}
              </Text>
            )}

            <Box
              className={css.MembersGroup}
              style={page ? { padding: `0 ${config.space.S400}` } : undefined}
              direction="Column"
              gap="100"
            >
              <div
                ref={listRef}
                style={{
                  position: 'relative',
                  height: virtualizer.getTotalSize(),
                }}
              >
                {virtualizer.getVirtualItems().map((vItem) => {
                  const tagOrMember = PLTagOrRoomMember[vItem.index];
                  if (!('userId' in tagOrMember)) {
                    return (
                      <Text
                        style={{
                          transform: `translateY(${vItem.start - listOffset}px)`,
                        }}
                        data-index={vItem.index}
                        ref={virtualizer.measureElement}
                        key={`${room.roomId}-${vItem.index}`}
                        className={classNames(
                          page ? css.PageGroupLabel : css.MembersGroupLabel,
                          css.DrawerVirtualItem
                        )}
                        size="L400"
                        priority={page ? '300' : undefined}
                      >
                        {`${page ? tagOrMember.name : tagOrMember.name.toUpperCase()} — ${
                          groupCounts.get(tagOrMember) ?? 0
                        }`}
                      </Text>
                    );
                  }

                  return (
                    <div
                      style={{
                        transform: `translateY(${vItem.start - listOffset}px)`,
                      }}
                      className={classNames(css.DrawerVirtualItem, page && css.PageRow)}
                      data-first={page && !isMember(PLTagOrRoomMember[vItem.index - 1])}
                      data-last={page && !isMember(PLTagOrRoomMember[vItem.index + 1])}
                      data-index={vItem.index}
                      key={`${room.roomId}-${tagOrMember.userId}`}
                      ref={virtualizer.measureElement}
                    >
                      <MemberItem
                        mx={mx}
                        useAuthentication={useAuthentication}
                        room={room}
                        member={tagOrMember}
                        onClick={handleMemberClick}
                        onContextMenu={handleMemberContextMenu}
                        pressed={openProfileUserId === tagOrMember.userId}
                        typing={typingMembers.some(
                          (receipt) => receipt.userId === tagOrMember.userId
                        )}
                        large={page}
                        nameColor={nameColorOf(tagOrMember.userId)}
                        nameGradient={nameGradientOf(tagOrMember.userId)}
                      />
                    </div>
                  );
                })}
              </div>
            </Box>

            {fetchingMembers && (
              <Box justifyContent="Center">
                <Spinner />
              </Box>
            )}
          </Box>
        </Scroll>
      </Box>
      {memberMenu && (
        <MemberContextMenu
          key={memberMenu.userId}
          room={room}
          userId={memberMenu.userId}
          name={
            getMemberDisplayName(room, memberMenu.userId) ??
            getMxIdLocalPart(memberMenu.userId) ??
            memberMenu.userId
          }
          anchor={memberMenu.anchor}
          onClose={() => setMemberMenu(undefined)}
        />
      )}
    </Box>
  );
}

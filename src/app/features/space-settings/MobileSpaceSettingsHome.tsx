import React, { Fragment, useRef } from 'react';
import {
  Avatar,
  Box,
  Icon,
  IconButton,
  Icons,
  IconSrc,
  Scroll,
  Text,
  color,
  config,
  toRem,
} from 'folds';
import millify from 'millify';
import { Room } from 'matrix-js-sdk';
import { RoomAvatar } from '../../components/room-avatar';
import { useRoomBannerUrl } from '../../hooks/useRoomBanner';
import { LEVEL_ANIMATED_BANNER, useSpaceLevel } from '../../hooks/useSpaceLevel';
import { useStillImage } from '../../hooks/useStillImage';
import { nameInitials } from '../../utils/common';
import * as css from '../settings/styles.css';
import { useScrollFade } from '../../hooks/useScrollFade';
import { ScrollFade } from '../../styles/ScrollFade.css';

type Item<P> = { page: P; name: string; icon: IconSrc };
type Group<P> = { title: string; items: Item<P>[] };

type MobileSpaceSettingsHomeProps<P> = {
  room: Room;
  name: string;
  avatarUrl?: string;
  groups: Group<P>[];
  onSelect: (page: P) => void;
  requestClose: () => void;
};
// Phone space settings home: the server card on top, then big grouped rows like user settings.
export function MobileSpaceSettingsHome<P>({
  room,
  name,
  avatarUrl,
  groups,
  onSelect,
  requestClose,
}: MobileSpaceSettingsHomeProps<P>) {
  const scrollRef = useRef<HTMLDivElement>(null);
  useScrollFade(scrollRef);
  const { level, members } = useSpaceLevel(room);
  const bannerUrl = useStillImage(useRoomBannerUrl(room), level < LEVEL_ANIMATED_BANNER);

  return (
    <Box grow="Yes" direction="Column" style={{ height: '100%' }}>
      <Box
        shrink="No"
        alignItems="Center"
        gap="200"
        style={{ padding: `${config.space.S300} ${config.space.S200}` }}
      >
        <IconButton onClick={requestClose} variant="Background" aria-label="Close">
          <Icon src={Icons.Cross} />
        </IconButton>
        <Text size="H3">Server Settings</Text>
      </Box>
      <Box grow="Yes" style={{ minHeight: 0 }}>
        <Scroll ref={scrollRef} className={ScrollFade} size="0" hideTrack visibility="Hover">
          <Box
            direction="Column"
            gap="500"
            style={{ padding: `${config.space.S200} ${config.space.S400} ${config.space.S700}` }}
          >
            <div className={css.MobileGroup}>
              <div
                className={css.MobileProfileBanner}
                style={{
                  backgroundColor: color.Primary.Container,
                  backgroundImage: bannerUrl ? `url("${bannerUrl}")` : undefined,
                }}
              />
              <Box direction="Column" gap="200" style={{ padding: config.space.S400 }}>
                <div className={css.MobileProfileAvatar} style={{ borderRadius: '50%' }}>
                  <Avatar size="500" radii="Pill" style={{ width: toRem(80), height: toRem(80) }}>
                    <RoomAvatar
                      roomId={room.roomId}
                      src={avatarUrl}
                      alt={name}
                      renderFallback={() => <Text size="H3">{nameInitials(name, 2)}</Text>}
                    />
                  </Avatar>
                </div>
                <Text size="H3" truncate>
                  {name}
                </Text>
                <Text size="T300" priority="300">
                  {`${millify(members)} ${members === 1 ? 'Member' : 'Members'} · ${
                    level > 0 ? `Server Level ${level}` : 'No level yet'
                  }`}
                </Text>
              </Box>
            </div>

            {groups.map((group) => (
              <Box key={group.title} direction="Column" gap="200">
                <Text size="L400" priority="300" style={{ paddingLeft: config.space.S100 }}>
                  {group.title}
                </Text>
                <div className={css.MobileGroup}>
                  {group.items.map((item, index) => (
                    <Fragment key={item.name}>
                      {index > 0 && <div className={css.MobileRowDivider} />}
                      <button
                        type="button"
                        className={css.MobileRow}
                        onClick={() => onSelect(item.page)}
                      >
                        <Icon src={item.icon} size="200" />
                        <Text as="span" size="T400" style={{ flexGrow: 1 }} truncate>
                          {item.name}
                        </Text>
                        <Icon src={Icons.ChevronRight} size="100" />
                      </button>
                    </Fragment>
                  ))}
                </div>
              </Box>
            ))}
          </Box>
        </Scroll>
      </Box>
    </Box>
  );
}

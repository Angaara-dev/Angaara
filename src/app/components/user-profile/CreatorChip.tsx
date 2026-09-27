import { Chip, config, Icon, Icons, Menu, MenuItem, PopOut, RectCords, Text } from 'folds';
import React, { MouseEventHandler, useState } from 'react';
import FocusTrap from 'focus-trap-react';
import { isKeyHotkey } from 'is-hotkey';
import { PowerColorBadge, PowerIcon, roleChipProps, roleNameStyle } from '../power';
import { getPowerTagIconSrc, useGatedCreatorsTag } from '../../hooks/useMemberPowerTag';
import { useTheme } from '../../hooks/useTheme';
import { accessibleColor } from '../../plugins/color';
import { useMatrixClient } from '../../hooks/useMatrixClient';
import { useMediaAuthentication } from '../../hooks/useMediaAuthentication';
import { stopPropagation } from '../../utils/keyboard';
import { useRoom } from '../../hooks/useRoom';
import { useSpaceOptionally } from '../../hooks/useSpace';
import { useOpenRoomSettings } from '../../state/hooks/roomSettings';
import { useOpenSpaceSettings } from '../../state/hooks/spaceSettings';
import { SpaceSettingsPage } from '../../state/spaceSettings';
import { RoomSettingsPage } from '../../state/roomSettings';

export function CreatorChip() {
  const mx = useMatrixClient();
  const useAuthentication = useMediaAuthentication();
  const room = useRoom();
  const space = useSpaceOptionally();
  const openRoomSettings = useOpenRoomSettings();
  const openSpaceSettings = useOpenSpaceSettings();

  const [cords, setCords] = useState<RectCords>();
  const tag = useGatedCreatorsTag(room);
  const theme = useTheme();
  const tagColor = tag.color ? accessibleColor(theme.kind, tag.color) : undefined;
  const tagGradient = tag.gradient ? accessibleColor(theme.kind, tag.gradient) : undefined;
  const roleChip = roleChipProps(tagColor, tagGradient);
  const tagIconSrc = tag.icon && getPowerTagIconSrc(mx, useAuthentication, tag.icon);

  const open: MouseEventHandler<HTMLButtonElement> = (evt) => {
    setCords(evt.currentTarget.getBoundingClientRect());
  };

  const close = () => setCords(undefined);

  return (
    <PopOut
      anchor={cords}
      position="Bottom"
      align="Start"
      offset={4}
      content={
        <FocusTrap
          focusTrapOptions={{
            initialFocus: false,
            onDeactivate: close,
            clickOutsideDeactivates: true,
            escapeDeactivates: stopPropagation,
            isKeyForward: (evt: KeyboardEvent) => isKeyHotkey('arrowdown', evt),
            isKeyBackward: (evt: KeyboardEvent) => isKeyHotkey('arrowup', evt),
          }}
        >
          <Menu>
            <div style={{ padding: config.space.S100 }}>
              <MenuItem
                variant="Surface"
                fill="None"
                size="300"
                radii="300"
                onClick={() => {
                  // Roles live in the server's settings; channels outside a server keep their own.
                  if (room.isSpaceRoom() || space) {
                    openSpaceSettings(
                      (room.isSpaceRoom() ? room.roomId : space?.roomId) ?? room.roomId,
                      undefined,
                      SpaceSettingsPage.RolesPage
                    );
                  } else {
                    openRoomSettings(room.roomId, space?.roomId, RoomSettingsPage.PermissionsPage);
                  }
                  close();
                }}
              >
                <Text size="B300">Manage Roles</Text>
              </MenuItem>
            </div>
          </Menu>
        </FocusTrap>
      }
    >
      <Chip
        variant="SurfaceVariant"
        outlined
        className={roleChip.className}
        style={roleChip.style}
        radii="Pill"
        before={
          cords ? (
            <Icon size="50" src={Icons.ChevronBottom} />
          ) : (
            <PowerColorBadge color={tagColor} gradient={tagGradient} />
          )
        }
        after={tagIconSrc ? <PowerIcon size="50" iconSrc={tagIconSrc} /> : undefined}
        onClick={open}
        aria-pressed={!!cords}
      >
        <Text size="B300" truncate style={roleNameStyle(tagColor, tagGradient)}>
          {tag.name}
        </Text>
      </Chip>
    </PopOut>
  );
}

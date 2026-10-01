import React, { useCallback, useRef, useState } from 'react';
import FocusTrap from 'focus-trap-react';
import { useAtomValue, useSetAtom } from 'jotai';
import {
  Box,
  color,
  config,
  Icon,
  IconButton,
  Icons,
  IconSrc,
  Menu,
  MenuItem,
  PopOut,
  RectCords,
  Text,
  Tooltip,
  TooltipProvider,
} from 'folds';
import { CallEmbed, useCallControlState } from '../../plugins/call';
import { useCallJoined } from '../../hooks/useCallEmbed';
import { useRoomName } from '../../hooks/useRoomMeta';
import { useRoomNavigate } from '../../hooks/useRoomNavigate';
import { callEmbedAtom, callViewRoomAtom } from '../../state/callEmbed';
import { AsyncStatus, useAsyncCallback } from '../../hooks/useAsyncCallback';
import { useMatrixClient } from '../../hooks/useMatrixClient';
import { roomToParentsAtom } from '../../state/room/roomToParents';
import { getOrphanParents } from '../../utils/room';
import { useResizeObserver } from '../../hooks/useResizeObserver';
import { stopPropagation } from '../../utils/keyboard';
import { SoundboardPopout } from '../soundboard/SoundboardPopout';
import { ConnectionPanel } from './ConnectionPanel';
import { SoundboardIcon } from '../soundboard/SoundboardIcon';
import { AudioDevicesPopout } from './AudioDevices';
import { useCameraToggle } from '../../hooks/useCamera';
import * as css from './VoicePanel.css';

type ControlProps = {
  label: string;
  icon: IconSrc;
  disabled?: boolean;
  onClick: (evt: React.MouseEvent<HTMLButtonElement>) => void;
};
// 'off' marks something you muted, 'on' something you're sharing.
type TileProps = ControlProps & { tone?: 'off' | 'on' };
function Tile({ label, icon, tone, disabled, onClick }: TileProps) {
  return (
    <TooltipProvider
      position="Top"
      tooltip={
        <Tooltip>
          <Text size="T200">{label}</Text>
        </Tooltip>
      }
    >
      {(ref) => (
        <button
          ref={ref}
          type="button"
          className={css.Tile}
          aria-label={label}
          aria-pressed={!!tone}
          data-tone={tone}
          disabled={disabled}
          onClick={onClick}
        >
          <Icon size="200" src={icon} filled={!!tone} />
        </button>
      )}
    </TooltipProvider>
  );
}

function HeadButton({ label, icon, disabled, onClick }: ControlProps) {
  return (
    <TooltipProvider
      position="Top"
      tooltip={
        <Tooltip>
          <Text size="T200">{label}</Text>
        </Tooltip>
      }
    >
      {(ref) => (
        <IconButton
          ref={ref}
          size="300"
          radii="300"
          variant="SurfaceVariant"
          fill="None"
          aria-label={label}
          disabled={disabled}
          onClick={onClick}
          style={{ flexShrink: 0 }}
        >
          <Icon size="100" src={icon} />
        </IconButton>
      )}
    </TooltipProvider>
  );
}

// The call you're in, kept above your profile so it's reachable from any channel.
export function VoicePanel({ embed }: { embed: CallEmbed }) {
  const mx = useMatrixClient();
  const joined = useCallJoined(embed);
  const name = useRoomName(embed.room);
  const roomToParents = useAtomValue(roomToParentsAtom);
  const { navigateRoom } = useRoomNavigate();
  const setCallEmbed = useSetAtom(callEmbedAtom);
  const setCallViewRoom = useSetAtom(callViewRoomAtom);
  const openCall = () => {
    if (!embed.room.isCallRoom()) setCallViewRoom(embed.roomId);
    navigateRoom(embed.roomId);
  };
  const { microphone, sound, video, screenshare } = useCallControlState(embed.control);
  const toggleVideo = useCameraToggle(
    useCallback(() => embed.control.toggleVideo(), [embed]),
    !video
  );

  const parentId = getOrphanParents(roomToParents, embed.roomId)[0];
  const serverName = parentId ? mx.getRoom(parentId)?.name : undefined;

  const [hangupState, hangup] = useAsyncCallback(useCallback(() => embed.hangup(), [embed]));
  const leaving =
    hangupState.status === AsyncStatus.Loading || hangupState.status === AsyncStatus.Success;
  const leave = () => {
    if (!joined) setCallEmbed(undefined);
    else hangup();
  };
  const tone = joined ? color.Success.Main : color.Warning.Main;

  // A narrow sidebar folds the two header buttons into one menu.
  const panelRef = useRef<HTMLDivElement>(null);
  const [narrow, setNarrow] = useState(false);
  useResizeObserver(
    useCallback(() => setNarrow((panelRef.current?.clientWidth ?? 999) < 232), []),
    useCallback(() => panelRef.current, [])
  );
  const [menuCords, setMenuCords] = useState<RectCords>();
  const [infoCords, setInfoCords] = useState<RectCords>();
  const infoRef = useRef<HTMLDivElement>(null);
  const runMenu = (action: () => void) => () => {
    setMenuCords(undefined);
    action();
  };

  return (
    <Box ref={panelRef} className={css.VoicePanel} direction="Column" gap="200">
      <Box alignItems="Start" gap="100">
        <span className={css.Badge} style={{ color: tone, alignSelf: 'center' }}>
          <Icon size="200" src={Icons.VolumeHighLock} />
        </span>
        <Box direction="Column" grow="Yes" style={{ minWidth: 0 }}>
          <PopOut
            anchor={infoCords}
            position="Top"
            align="Start"
            offset={8}
            content={
              <FocusTrap
                focusTrapOptions={{
                  initialFocus: false,
                  // The panel is only text, so the trap needs somewhere to put focus.
                  fallbackFocus: () => infoRef.current ?? document.body,
                  onDeactivate: () => setInfoCords(undefined),
                  clickOutsideDeactivates: true,
                  escapeDeactivates: stopPropagation,
                }}
              >
                <div ref={infoRef} tabIndex={-1} style={{ outline: 'none' }}>
                  <ConnectionPanel embed={embed} />
                </div>
              </FocusTrap>
            }
          >
            <button
              type="button"
              className={css.Channel}
              aria-label="Connection details"
              aria-expanded={!!infoCords}
              onClick={(evt) =>
                setInfoCords(infoCords ? undefined : evt.currentTarget.getBoundingClientRect())
              }
            >
              <Text size="T300" style={{ color: tone, fontWeight: 600, display: 'block' }} truncate>
                {joined ? 'Voice Connected' : 'Connecting...'}
              </Text>
            </button>
          </PopOut>
          <button type="button" className={css.Channel} onClick={openCall}>
            <Text as="span" size="T200" priority="300" truncate style={{ display: 'block' }}>
              {serverName ? `${serverName} / ${name}` : name}
              {embed.room.hasEncryptionStateEvent() && ` · AES-${embed.keySize}`}
            </Text>
          </button>
        </Box>
        {narrow ? (
          <PopOut
            anchor={menuCords}
            position="Top"
            align="End"
            content={
              <FocusTrap
                focusTrapOptions={{
                  initialFocus: false,
                  onDeactivate: () => setMenuCords(undefined),
                  clickOutsideDeactivates: true,
                  escapeDeactivates: stopPropagation,
                }}
              >
                <Menu style={{ padding: config.space.S100 }}>
                  <MenuItem
                    size="300"
                    radii="300"
                    before={<Icon size="100" src={Icons.ArrowGoRight} />}
                    onClick={runMenu(openCall)}
                  >
                    <Text size="T300">Open Call</Text>
                  </MenuItem>
                  <MenuItem
                    size="300"
                    radii="300"
                    variant="Critical"
                    fill="None"
                    disabled={leaving}
                    before={<Icon size="100" src={Icons.PhoneDown} />}
                    onClick={runMenu(leave)}
                  >
                    <Text size="T300">Disconnect</Text>
                  </MenuItem>
                </Menu>
              </FocusTrap>
            }
          >
            <HeadButton
              label="Call Options"
              icon={Icons.VerticalDots}
              onClick={(evt) => setMenuCords(evt.currentTarget.getBoundingClientRect())}
            />
          </PopOut>
        ) : (
          <>
            <HeadButton label="Open Call" icon={Icons.ArrowGoRight} onClick={openCall} />
            <HeadButton
              label="Disconnect"
              icon={Icons.PhoneDown}
              disabled={leaving}
              onClick={leave}
            />
          </>
        )}
      </Box>
      <div className={css.Tiles}>
        <Tile
          label={microphone ? 'Mute' : 'Unmute'}
          icon={microphone ? Icons.Mic : Icons.MicMute}
          tone={microphone ? undefined : 'off'}
          disabled={!joined}
          onClick={() => embed.control.toggleMicrophone()}
        />
        <Tile
          label={sound ? 'Deafen' : 'Undeafen'}
          icon={sound ? Icons.VolumeHigh : Icons.VolumeMute}
          tone={sound ? undefined : 'off'}
          disabled={!joined}
          onClick={() => embed.control.toggleSound()}
        />
        <AudioDevicesPopout embed={embed}>
          {(toggle, open) => (
            <Tile
              label="Audio Devices"
              icon={Icons.Setting}
              tone={open ? 'on' : undefined}
              onClick={toggle}
            />
          )}
        </AudioDevicesPopout>
        <Tile
          label={video ? 'Turn Off Camera' : 'Turn On Camera'}
          icon={video ? Icons.VideoCamera : Icons.VideoCameraMute}
          tone={video ? 'on' : undefined}
          disabled={!joined}
          onClick={toggleVideo}
        />
        <Tile
          label={screenshare ? 'Stop Sharing' : 'Share Your Screen'}
          icon={Icons.ScreenShare}
          tone={screenshare ? 'on' : undefined}
          disabled={!joined}
          onClick={() => embed.control.toggleScreenshare()}
        />
        <SoundboardPopout embed={embed}>
          {(toggle, open) => (
            <Tile
              label="Soundboard"
              icon={SoundboardIcon}
              tone={open ? 'on' : undefined}
              disabled={!joined}
              onClick={toggle}
            />
          )}
        </SoundboardPopout>
      </div>
    </Box>
  );
}

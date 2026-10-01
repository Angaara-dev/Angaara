import React, { useCallback } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';
import {
  Box,
  color,
  Icon,
  IconButton,
  Icons,
  IconSrc,
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
import * as css from './VoicePanel.css';

type ControlProps = {
  label: string;
  icon: IconSrc;
  disabled?: boolean;
  onClick: () => void;
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
          size="200"
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

  return (
    <Box className={css.VoicePanel} direction="Column" gap="200">
      <Box alignItems="Center" gap="100">
        <span className={css.Badge} style={{ color: tone }}>
          <Icon size="200" src={Icons.VolumeHighLock} />
        </span>
        <Box direction="Column" grow="Yes" style={{ minWidth: 0 }}>
          <Text size="T300" style={{ color: tone, fontWeight: 600 }} truncate>
            {joined ? 'Voice Connected' : 'Connecting...'}
          </Text>
          <button type="button" className={css.Channel} onClick={openCall}>
            <Text as="span" size="T200" priority="300" truncate>
              {serverName ? `${serverName} / ${name}` : name}
              {embed.room.hasEncryptionStateEvent() && ` · 🔒 AES-${embed.keySize}`}
            </Text>
          </button>
        </Box>
        <HeadButton label="Open Call" icon={Icons.ArrowGoRight} onClick={openCall} />
        <HeadButton label="Disconnect" icon={Icons.PhoneDown} disabled={leaving} onClick={leave} />
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
        <Tile
          label={video ? 'Turn Off Camera' : 'Turn On Camera'}
          icon={video ? Icons.VideoCamera : Icons.VideoCameraMute}
          tone={video ? 'on' : undefined}
          disabled={!joined}
          onClick={() => embed.control.toggleVideo()}
        />
        <Tile
          label={screenshare ? 'Stop Sharing' : 'Share Your Screen'}
          icon={Icons.ScreenShare}
          tone={screenshare ? 'on' : undefined}
          disabled={!joined}
          onClick={() => embed.control.toggleScreenshare()}
        />
      </div>
    </Box>
  );
}

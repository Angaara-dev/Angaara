import React, { useCallback } from 'react';
import { useSetAtom } from 'jotai';
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
import { callEmbedAtom } from '../../state/callEmbed';
import { AsyncStatus, useAsyncCallback } from '../../hooks/useAsyncCallback';
import * as css from './VoicePanel.css';

type ControlProps = {
  label: string;
  icon: IconSrc;
  active?: boolean;
  danger?: boolean;
  disabled?: boolean;
  onClick: () => void;
};
function Control({ label, icon, active, danger, disabled, onClick }: ControlProps) {
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
          variant={danger ? 'Critical' : 'SurfaceVariant'}
          fill={danger ? 'Soft' : 'None'}
          aria-label={label}
          aria-pressed={active}
          disabled={disabled}
          onClick={onClick}
        >
          <Icon size="100" src={icon} filled={active} />
        </IconButton>
      )}
    </TooltipProvider>
  );
}

// The call you're in, kept above your profile so it's reachable from any channel.
export function VoicePanel({ embed }: { embed: CallEmbed }) {
  const joined = useCallJoined(embed);
  const name = useRoomName(embed.room);
  const { navigateRoom } = useRoomNavigate();
  const setCallEmbed = useSetAtom(callEmbedAtom);
  const { microphone, sound, screenshare } = useCallControlState(embed.control);

  const [hangupState, hangup] = useAsyncCallback(useCallback(() => embed.hangup(), [embed]));
  const leaving =
    hangupState.status === AsyncStatus.Loading || hangupState.status === AsyncStatus.Success;
  const leave = () => {
    if (!joined) setCallEmbed(undefined);
    else hangup();
  };

  return (
    <Box className={css.VoicePanel} direction="Column" gap="100">
      <Box alignItems="Center" gap="200">
        <Box direction="Column" grow="Yes" style={{ minWidth: 0 }}>
          <Box alignItems="Center" gap="100">
            <Icon
              size="50"
              src={Icons.VolumeHigh}
              style={{ color: joined ? color.Success.Main : color.Warning.Main }}
            />
            <Text
              size="L400"
              style={{ color: joined ? color.Success.Main : color.Warning.Main }}
              truncate
            >
              {joined ? 'Voice Connected' : 'Connecting...'}
            </Text>
          </Box>
          <button type="button" className={css.Channel} onClick={() => navigateRoom(embed.roomId)}>
            <Text as="span" size="T200" priority="300" truncate>
              {name}
              {embed.room.hasEncryptionStateEvent() && ` · 🔒 AES-${embed.keySize}`}
            </Text>
          </button>
        </Box>
        <Control
          label="Disconnect"
          icon={Icons.PhoneDown}
          danger
          disabled={leaving}
          onClick={leave}
        />
      </Box>
      <Box gap="100" justifyContent="SpaceBetween">
        <Control
          label={microphone ? 'Mute' : 'Unmute'}
          icon={microphone ? Icons.Mic : Icons.MicMute}
          active={!microphone}
          disabled={!joined}
          onClick={() => embed.control.toggleMicrophone()}
        />
        <Control
          label={sound ? 'Deafen' : 'Undeafen'}
          icon={sound ? Icons.VolumeHigh : Icons.VolumeMute}
          active={!sound}
          disabled={!joined}
          onClick={() => embed.control.toggleSound()}
        />
        <Control
          label={screenshare ? 'Stop Sharing' : 'Share Your Screen'}
          icon={Icons.ScreenShare}
          active={screenshare}
          disabled={!joined}
          onClick={() => embed.control.toggleScreenshare()}
        />
        <Control
          label="Open Call"
          icon={Icons.ArrowGoRight}
          onClick={() => navigateRoom(embed.roomId)}
        />
      </Box>
    </Box>
  );
}

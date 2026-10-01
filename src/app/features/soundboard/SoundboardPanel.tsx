import React, { useState } from 'react';
import { useAtomValue } from 'jotai';
import { Box, color, Icon, IconButton, Icons, Scroll, Text } from 'folds';
import { Room } from 'matrix-js-sdk';
import { useMatrixClient } from '../../hooks/useMatrixClient';
import { useMediaAuthentication } from '../../hooks/useMediaAuthentication';
import { useCallJoined } from '../../hooks/useCallEmbed';
import { useSetting } from '../../state/hooks/settings';
import { settingsAtom } from '../../state/settings';
import { roomToParentsAtom } from '../../state/room/roomToParents';
import { getOrphanParents } from '../../utils/room';
import { CallEmbed } from '../../plugins/call/CallEmbed';
import { BUILTIN_SOUNDS } from '../../plugins/soundboard/builtin';
import { playLocal } from '../../plugins/soundboard/audio';
import { playSoundInCall } from '../../plugins/soundboard/play';
import {
  canEditServerSounds,
  savePersonalSounds,
  saveServerSounds,
  usePersonalSounds,
  useServerSounds,
} from '../../plugins/soundboard/library';
import { Sound } from '../../plugins/soundboard/types';
import { varName } from '../../utils/accent';
import * as css from './SoundboardPanel.css';

type SectionProps = {
  title: string;
  sounds: Sound[];
  playing?: string;
  disabled: boolean;
  onPlay: (sound: Sound) => void;
  onPreview: (sound: Sound) => void;
  onRemove?: (sound: Sound) => void;
  onAdd?: () => void;
  empty?: string;
};
function Section({
  title,
  sounds,
  playing,
  disabled,
  onPlay,
  onPreview,
  onRemove,
  onAdd,
  empty,
}: SectionProps) {
  return (
    <Box direction="Column" gap="100">
      <Text size="L400" priority="300">
        {title}
      </Text>
      <div className={css.Grid}>
        {sounds.map((sound) => (
          <div key={sound.id} className={css.Tile} data-playing={playing === sound.id}>
            <button
              type="button"
              className={css.TileMain}
              disabled={disabled}
              onClick={() => onPlay(sound)}
              title={disabled ? 'Join a call to play sounds' : `Play ${sound.name}`}
            >
              <span className={css.Emoji}>{sound.emoji || '🔊'}</span>
              <Text as="span" size="T200" truncate>
                {sound.name}
              </Text>
            </button>
            <span className={css.TileActions}>
              <button
                type="button"
                className={css.TileAction}
                aria-label={`Preview ${sound.name} just for you`}
                title="Preview just for you"
                onClick={() => onPreview(sound)}
              >
                <Icon size="50" src={Icons.Play} />
              </button>
              {onRemove && (
                <button
                  type="button"
                  className={css.TileAction}
                  aria-label={`Remove ${sound.name}`}
                  title="Remove"
                  onClick={() => onRemove(sound)}
                >
                  <Icon size="50" src={Icons.Cross} />
                </button>
              )}
            </span>
          </div>
        ))}
        {onAdd && (
          <button type="button" className={css.AddTile} onClick={onAdd}>
            <Icon size="100" src={Icons.Plus} />
            <Text as="span" size="T200">
              Add Sound
            </Text>
          </button>
        )}
      </div>
      {sounds.length === 0 && !onAdd && empty && (
        <Text size="T200" priority="300">
          {empty}
        </Text>
      )}
    </Box>
  );
}

const serverOf = (mx: ReturnType<typeof useMatrixClient>, parents: string[]): Room | undefined =>
  parents[0] ? mx.getRoom(parents[0]) ?? undefined : undefined;

// Every sound you can play in this call: the starter pack, the server's, and your own.
type SoundboardPanelProps = {
  embed: CallEmbed;
  onAdd: (target: { personal: Sound[]; server?: Room; serverSounds: Sound[] }) => void;
};
export function SoundboardPanel({ embed, onAdd }: SoundboardPanelProps) {
  const mx = useMatrixClient();
  const useAuthentication = useMediaAuthentication();
  const joined = useCallJoined(embed);
  const roomToParents = useAtomValue(roomToParentsAtom);
  const server = serverOf(mx, getOrphanParents(roomToParents, embed.roomId));
  const personal = usePersonalSounds();
  const serverSounds = useServerSounds(server);
  const canEditServer = canEditServerSounds(mx, server);
  const [volume, setVolume] = useSetting(settingsAtom, 'soundboardVolume');
  const [muted, setMuted] = useSetting(settingsAtom, 'soundboardMuted');
  const [playing, setPlaying] = useState<string>();
  const [error, setError] = useState<string>();

  const play = (sound: Sound) => {
    setError(undefined);
    setPlaying(sound.id);
    playSoundInCall(mx, embed, sound, useAuthentication, volume / 100)
      .catch(() => setError("Couldn't play that sound."))
      .finally(() => setTimeout(() => setPlaying(undefined), 500));
  };
  const preview = (sound: Sound) => {
    playLocal(mx, sound, useAuthentication, volume / 100).catch(() =>
      setError("Couldn't load that sound.")
    );
  };

  return (
    <div className={css.Panel}>
      <Box className={css.PanelHeader} alignItems="Center" gap="200">
        <Box grow="Yes">
          <Text size="H5">Soundboard</Text>
        </Box>
        <IconButton
          size="300"
          radii="300"
          variant="SurfaceVariant"
          fill="None"
          aria-label={muted ? "Hear other people's sounds" : "Mute other people's sounds"}
          title={muted ? "Hear other people's sounds" : "Mute other people's sounds"}
          onClick={() => setMuted(!muted)}
        >
          <Icon size="100" src={muted ? Icons.VolumeMute : Icons.VolumeHigh} />
        </IconButton>
      </Box>
      <Box className={css.VolumeRow} direction="Column" gap="200">
        <Text size="L400">Sound Volume</Text>
        <input
          className={css.Volume}
          type="range"
          min={0}
          max={100}
          value={volume}
          disabled={muted}
          aria-label="Sound volume for other people's sounds"
          title={`${volume}%`}
          style={{ [varName(css.volumeFill) ?? '']: `${muted ? 0 : volume}%` }}
          onChange={(e) => setVolume(Number(e.currentTarget.value))}
        />
      </Box>
      <Scroll size="300" hideTrack visibility="Hover">
        <Box direction="Column" gap="400" className={css.PanelBody}>
          {error && (
            <Text size="T200" style={{ color: color.Critical.Main }}>
              {error}
            </Text>
          )}
          <Section
            title="Your Sounds"
            sounds={personal}
            playing={playing}
            disabled={!joined}
            onPlay={play}
            onPreview={preview}
            onRemove={(sound) =>
              savePersonalSounds(
                mx,
                personal.filter((s) => s.id !== sound.id)
              ).catch(() => setError("Couldn't remove that sound."))
            }
            onAdd={() => onAdd({ personal, server, serverSounds })}
          />
          {server && (
            <Section
              title={server.name}
              sounds={serverSounds}
              playing={playing}
              disabled={!joined}
              onPlay={play}
              onPreview={preview}
              onRemove={
                canEditServer
                  ? (sound) =>
                      saveServerSounds(
                        mx,
                        server,
                        serverSounds.filter((s) => s.id !== sound.id)
                      ).catch(() => setError("Couldn't remove that sound."))
                  : undefined
              }
              onAdd={canEditServer ? () => onAdd({ personal, server, serverSounds }) : undefined}
              empty="No server sounds yet. Admins can add some."
            />
          )}
          <Section
            title="Starter Pack"
            sounds={BUILTIN_SOUNDS}
            playing={playing}
            disabled={!joined}
            onPlay={play}
            onPreview={preview}
          />
        </Box>
      </Scroll>
    </div>
  );
}

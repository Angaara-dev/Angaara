import React, { FormEventHandler, useState } from 'react';
import FocusTrap from 'focus-trap-react';
import {
  Box,
  Button,
  Chip,
  Dialog,
  Header,
  Icon,
  IconButton,
  Icons,
  Input,
  Overlay,
  OverlayBackdrop,
  OverlayCenter,
  Spinner,
  Text,
  color,
  config,
} from 'folds';
import { Room } from 'matrix-js-sdk';
import { useMatrixClient } from '../../hooks/useMatrixClient';
import { stopPropagation } from '../../utils/keyboard';
import { checkSoundFile } from '../../plugins/soundboard/audio';
import {
  savePersonalSounds,
  saveServerSounds,
  uploadSound,
} from '../../plugins/soundboard/library';
import { MAX_SOUND_NAME, MAX_SOUNDS, Sound } from '../../plugins/soundboard/types';

type Target = 'personal' | 'server';

type AddSoundDialogProps = {
  personal: Sound[];
  server?: Room;
  serverSounds: Sound[];
  canEditServer: boolean;
  requestClose: () => void;
};
export function AddSoundDialog({
  personal,
  server,
  serverSounds,
  canEditServer,
  requestClose,
}: AddSoundDialogProps) {
  const mx = useMatrixClient();
  const [file, setFile] = useState<File>();
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('');
  const [target, setTarget] = useState<Target>('personal');
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);

  const pickFile = async (picked?: File) => {
    setError(undefined);
    setFile(undefined);
    if (!picked) return;
    const problem = await checkSoundFile(picked);
    if (problem) {
      setError(problem);
      return;
    }
    setFile(picked);
    if (!name) setName(picked.name.replace(/\.[^.]+$/, '').slice(0, MAX_SOUND_NAME));
  };

  const handleSubmit: FormEventHandler<HTMLFormElement> = async (evt) => {
    evt.preventDefault();
    if (!file || saving) return;
    const list = target === 'server' ? serverSounds : personal;
    if (list.length >= MAX_SOUNDS) {
      setError(`That list is full (${MAX_SOUNDS} sounds). Remove one first.`);
      return;
    }
    setSaving(true);
    setError(undefined);
    try {
      const sound = await uploadSound(mx, file, name, emoji);
      if (target === 'server' && server) await saveServerSounds(mx, server, [...list, sound]);
      else await savePersonalSounds(mx, [...list, sound]);
      requestClose();
    } catch {
      setError("Couldn't save the sound. Try again in a moment.");
      setSaving(false);
    }
  };

  return (
    <Overlay open backdrop={<OverlayBackdrop />}>
      <OverlayCenter>
        <FocusTrap
          focusTrapOptions={{
            onDeactivate: requestClose,
            clickOutsideDeactivates: true,
            escapeDeactivates: stopPropagation,
          }}
        >
          <Dialog variant="Surface">
            <Header
              style={{
                padding: `0 ${config.space.S200} 0 ${config.space.S400}`,
                borderBottomWidth: config.borderWidth.B300,
              }}
              variant="Surface"
              size="500"
            >
              <Box grow="Yes">
                <Text size="H4">Add a Sound</Text>
              </Box>
              <IconButton size="300" radii="300" onClick={requestClose} aria-label="Close">
                <Icon src={Icons.Cross} />
              </IconButton>
            </Header>
            <Box
              as="form"
              onSubmit={handleSubmit}
              direction="Column"
              gap="400"
              style={{ padding: config.space.S400 }}
            >
              <Box direction="Column" gap="100">
                <Text size="L400">Sound file</Text>
                <input
                  type="file"
                  accept="audio/*"
                  aria-label="Sound file"
                  disabled={saving}
                  onChange={(e) => pickFile(e.currentTarget.files?.[0])}
                />
                <Text size="T200" priority="300">
                  Up to 10 seconds and 1 MB. MP3, OGG, WAV and most audio files work.
                </Text>
              </Box>
              <Box gap="200">
                <Box direction="Column" gap="100" style={{ width: '5rem' }}>
                  <Text size="L400">Emoji</Text>
                  <Input
                    value={emoji}
                    onChange={(e) =>
                      setEmoji(Array.from(e.currentTarget.value).slice(0, 2).join(''))
                    }
                    placeholder="🔊"
                    variant="Background"
                    radii="300"
                    readOnly={saving}
                  />
                </Box>
                <Box direction="Column" gap="100" grow="Yes">
                  <Text size="L400">Name</Text>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.currentTarget.value.slice(0, MAX_SOUND_NAME))}
                    maxLength={MAX_SOUND_NAME}
                    placeholder="Name your sound"
                    variant="Background"
                    radii="300"
                    readOnly={saving}
                  />
                </Box>
              </Box>
              {server && canEditServer && (
                <Box direction="Column" gap="100">
                  <Text size="L400">Add to</Text>
                  <Box gap="100">
                    <Chip
                      type="button"
                      variant={target === 'personal' ? 'Primary' : 'SurfaceVariant'}
                      radii="Pill"
                      aria-pressed={target === 'personal'}
                      onClick={() => setTarget('personal')}
                    >
                      <Text size="B300">Your sounds</Text>
                    </Chip>
                    <Chip
                      type="button"
                      variant={target === 'server' ? 'Primary' : 'SurfaceVariant'}
                      radii="Pill"
                      aria-pressed={target === 'server'}
                      onClick={() => setTarget('server')}
                    >
                      <Text size="B300">{server.name}</Text>
                    </Chip>
                  </Box>
                </Box>
              )}
              <Text size="T200" priority="300">
                {target === 'server'
                  ? 'Everyone in the server can play it in its calls.'
                  : 'You can play it in any call, in any server or DM.'}{' '}
                The file is stored on your homeserver like an avatar; playing it is end-to-end
                encrypted.
              </Text>
              {error && (
                <Text size="T200" style={{ color: color.Critical.Main }}>
                  {error}
                </Text>
              )}
              <Box gap="200" justifyContent="End">
                <Button
                  type="submit"
                  variant="Primary"
                  radii="300"
                  disabled={!file || saving}
                  before={saving && <Spinner size="100" variant="Primary" fill="Solid" />}
                >
                  <Text size="B400">Add Sound</Text>
                </Button>
              </Box>
            </Box>
          </Dialog>
        </FocusTrap>
      </OverlayCenter>
    </Overlay>
  );
}

import React, { FormEventHandler, useCallback, useState } from 'react';
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
import { useQueryClient } from '@tanstack/react-query';
import { useMatrixClient } from '../../hooks/useMatrixClient';
import { AsyncStatus, useAsyncCallback } from '../../hooks/useAsyncCallback';
import { extendedProfileQueryKey } from '../../hooks/useUserBanner';
import {
  LEGACY_STATUS_KEY,
  MAX_STATUS_LENGTH,
  STATUS_PROFILE_KEY,
  useUserStatus,
} from '../../hooks/useUserStatus';
import { stopPropagation } from '../../utils/keyboard';

const PRESETS = ['💻 Coding', '🎮 Gaming', '📚 Studying', '🎧 Vibing', '🌙 AFK'];

type StatusDialogProps = { userId: string; requestClose: () => void };
export function StatusDialog({ userId, requestClose }: StatusDialogProps) {
  const mx = useMatrixClient();
  const queryClient = useQueryClient();
  const current = useUserStatus(userId) ?? '';
  const [status, setStatus] = useState(current);
  const [error, setError] = useState<string>();

  const [saveState, save] = useAsyncCallback(
    useCallback(
      async (value: string) => {
        if (value) await mx.setExtendedProfileProperty(STATUS_PROFILE_KEY, value);
        else await mx.deleteExtendedProfileProperty(STATUS_PROFILE_KEY);
        // Drop the pre-rename copy so it can't resurface as a fallback.
        await mx.deleteExtendedProfileProperty(LEGACY_STATUS_KEY).catch(() => undefined);
        await queryClient.invalidateQueries({ queryKey: extendedProfileQueryKey(userId) });
      },
      [mx, queryClient, userId]
    )
  );
  const saving = saveState.status === AsyncStatus.Loading;

  const submit = (value: string) => {
    setError(undefined);
    save(value.trim())
      .then(requestClose)
      .catch(() => setError("Couldn't save your status. Your server may not support it."));
  };
  const handleSubmit: FormEventHandler<HTMLFormElement> = (evt) => {
    evt.preventDefault();
    if (!saving) submit(status);
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
                <Text size="H4">Set a Status</Text>
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
              <Box direction="Column" gap="200">
                <Input
                  value={status}
                  onChange={(evt) => setStatus(evt.currentTarget.value.slice(0, MAX_STATUS_LENGTH))}
                  maxLength={MAX_STATUS_LENGTH}
                  placeholder="What's happening?"
                  variant="Background"
                  radii="300"
                  autoFocus
                  readOnly={saving}
                />
                <Box gap="100" wrap="Wrap">
                  {PRESETS.map((preset) => (
                    <Chip
                      key={preset}
                      type="button"
                      variant="SurfaceVariant"
                      radii="Pill"
                      onClick={() => setStatus(preset)}
                    >
                      <Text size="B300">{preset}</Text>
                    </Chip>
                  ))}
                </Box>
                <Text size="T200" priority="300">
                  Shown on your profile and next to your name. Anyone using Angaara can see it.
                </Text>
              </Box>
              {error && (
                <Text size="T200" style={{ color: color.Critical.Main }}>
                  {error}
                </Text>
              )}
              <Box gap="200" justifyContent="End">
                {current && (
                  <Button
                    type="button"
                    variant="Critical"
                    fill="None"
                    radii="300"
                    disabled={saving}
                    onClick={() => submit('')}
                  >
                    <Text size="B400">Clear Status</Text>
                  </Button>
                )}
                <Button
                  type="submit"
                  variant="Primary"
                  radii="300"
                  disabled={saving || status.trim() === current}
                  before={saving && <Spinner size="100" variant="Primary" fill="Solid" />}
                >
                  <Text size="B400">Save</Text>
                </Button>
              </Box>
            </Box>
          </Dialog>
        </FocusTrap>
      </OverlayCenter>
    </Overlay>
  );
}

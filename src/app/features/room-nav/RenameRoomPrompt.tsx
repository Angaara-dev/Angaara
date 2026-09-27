import React, { FormEventHandler, useEffect, useRef, useState } from 'react';
import { Room } from 'matrix-js-sdk';
import {
  Box,
  Button,
  color,
  config,
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
} from 'folds';
import FocusTrap from 'focus-trap-react';
import { useMatrixClient } from '../../hooks/useMatrixClient';
import { stopPropagation } from '../../utils/keyboard';
import { EmojiInsertButton } from '../../components/EmojiInsertButton';

type RenameRoomPromptProps = {
  room: Room;
  requestClose: () => void;
};
export function RenameRoomPrompt({ room, requestClose }: RenameRoomPromptProps) {
  const mx = useMatrixClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();

  // The focus trap would select the whole name, so an emoji would replace it; start at the end.
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const input = inputRef.current;
      input?.focus();
      input?.setSelectionRange(input.value.length, input.value.length);
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  const handleSubmit: FormEventHandler<HTMLFormElement> = async (evt) => {
    evt.preventDefault();
    const name = inputRef.current?.value.trim();
    if (!name || saving) return;
    if (name === room.name) {
      requestClose();
      return;
    }
    setSaving(true);
    setError(undefined);
    try {
      await mx.setRoomName(room.roomId, name);
      requestClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not rename the channel.');
      setSaving(false);
    }
  };

  return (
    <Overlay open backdrop={<OverlayBackdrop />}>
      <OverlayCenter>
        <FocusTrap
          focusTrapOptions={{
            initialFocus: false,
            clickOutsideDeactivates: true,
            onDeactivate: requestClose,
            escapeDeactivates: stopPropagation,
          }}
        >
          <Dialog variant="Surface">
            <Header size="500" style={{ padding: `0 ${config.space.S200} 0 ${config.space.S400}` }}>
              <Box grow="Yes">
                <Text size="H4" truncate>
                  Rename Channel
                </Text>
              </Box>
              <IconButton size="300" radii="300" onClick={requestClose}>
                <Icon src={Icons.Cross} />
              </IconButton>
            </Header>
            <Box
              as="form"
              onSubmit={handleSubmit}
              direction="Column"
              gap="300"
              style={{ padding: `0 ${config.space.S400} ${config.space.S400}` }}
            >
              <Box direction="Column" gap="100">
                <Text size="L400">Channel Name</Text>
                <Input
                  ref={inputRef}
                  name="nameInput"
                  defaultValue={room.name}
                  variant="Background"
                  radii="300"
                  autoComplete="off"
                  required
                  disabled={saving}
                  after={<EmojiInsertButton inputRef={inputRef} disabled={saving} />}
                />
              </Box>
              {error && (
                <Text size="T200" style={{ color: color.Critical.Main }}>
                  <b>{error}</b>
                </Text>
              )}
              <Button
                type="submit"
                variant="Primary"
                radii="300"
                disabled={saving}
                before={saving && <Spinner size="100" variant="Primary" fill="Solid" />}
              >
                <Text size="B400">Save</Text>
              </Button>
            </Box>
          </Dialog>
        </FocusTrap>
      </OverlayCenter>
    </Overlay>
  );
}

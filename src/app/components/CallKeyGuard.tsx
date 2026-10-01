import React, { RefObject, useCallback, useEffect, useRef } from 'react';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { MatrixEvent, RoomStateEvent } from 'matrix-js-sdk';
import {
  Box,
  Button,
  Dialog,
  Icon,
  Icons,
  Overlay,
  OverlayBackdrop,
  OverlayCenter,
  Text,
  config,
  toRem,
} from 'folds';
import FocusTrap from 'focus-trap-react';
import { CallEmbed } from '../plugins/call';
import { CALL_KEY_EVENT, callNeedsWeakKeys, getCallKey, setCallKey } from '../plugins/call/keySize';
import { useMatrixClient } from '../hooks/useMatrixClient';
import { useCallMembers, useCallSession } from '../hooks/useCall';
import { createCallEmbed } from '../hooks/useCallEmbed';
import { useTheme } from '../hooks/useTheme';
import { callEmbedAtom, callKeyNoticeAtom } from '../state/callEmbed';
import { mDirectAtom } from '../state/mDirectList';

// A device can take a moment to post its Angaara marker after joining, so don't switch too soon.
const GRACE_MS = 4000;

type CallKeyGuardProps = {
  embed: CallEmbed;
  containerRef: RefObject<HTMLDivElement>;
};

// Keeps an AES-256 call safe to join: once anyone on another app is in it, everyone here
// rejoins on AES-128 for the rest of the call, and whoever started it is told why.
export function CallKeyGuard({ embed, containerRef }: CallKeyGuardProps) {
  const mx = useMatrixClient();
  const theme = useTheme();
  const directs = useAtomValue(mDirectAtom);
  const setCallEmbed = useSetAtom(callEmbedAtom);
  const session = useCallSession(embed.room);
  const members = useCallMembers(session);
  const setNotice = useSetAtom(callKeyNoticeAtom);
  const switching = useRef(false);

  const switchTo128 = useCallback(async () => {
    if (switching.current || embed.keySize !== 256) return;
    switching.current = true;
    const { room } = embed;
    if (getCallKey(room)?.size !== 128) await setCallKey(mx, room, 128).catch(() => undefined);
    if (embed.startedCall) setNotice(true);

    const container = containerRef.current;
    const state = embed.control.getState();
    await Promise.race([
      embed.hangup().catch(() => undefined),
      new Promise((resolve) => {
        setTimeout(resolve, 2000);
      }),
    ]);
    if (!container) {
      setCallEmbed(undefined);
      return;
    }
    const pref = { microphone: state.microphone, video: state.video, sound: state.sound };
    setCallEmbed(
      createCallEmbed(mx, room, directs.has(room.roomId), theme.kind, container, pref, 128)
    );
  }, [mx, embed, containerRef, directs, theme.kind, setCallEmbed, setNotice]);

  // Someone on another app joined.
  useEffect(() => {
    if (embed.keySize !== 256 || !callNeedsWeakKeys(embed.room, members)) return undefined;
    const timer = window.setTimeout(() => {
      const { memberships } = mx.matrixRTC.getRoomSession(embed.room);
      if (callNeedsWeakKeys(embed.room, memberships)) switchTo128();
    }, GRACE_MS);
    return () => window.clearTimeout(timer);
  }, [mx, embed, members, switchTo128]);

  // Another Angaara device in the call already switched it.
  useEffect(() => {
    if (embed.keySize !== 256) return undefined;
    const onState = () => {
      if (getCallKey(embed.room)?.size === 128) switchTo128();
    };
    const roomState = embed.room.currentState;
    const handler = (event: MatrixEvent) => {
      if (event.getType() === CALL_KEY_EVENT) onState();
    };
    roomState.on(RoomStateEvent.Events, handler);
    return () => {
      roomState.off(RoomStateEvent.Events, handler);
    };
  }, [embed, switchTo128]);

  return null;
}

// Told only to whoever started the call, since they picked AES-256 by starting it.
export function CallKeyNotice() {
  const [notice, setNotice] = useAtom(callKeyNoticeAtom);
  if (!notice) return null;
  return (
    <Overlay open backdrop={<OverlayBackdrop />}>
      <OverlayCenter>
        <FocusTrap
          focusTrapOptions={{
            initialFocus: false,
            onDeactivate: () => setNotice(false),
            clickOutsideDeactivates: true,
          }}
        >
          <Dialog style={{ maxWidth: toRem(380) }}>
            <Box direction="Column" gap="400" style={{ padding: config.space.S400 }}>
              <Box alignItems="Center" gap="200">
                <Icon size="200" src={Icons.Lock} />
                <Text size="H4">Call switched to AES-128</Text>
              </Box>
              <Text size="T300">
                Someone joined from another Matrix app that only supports AES-128, so the call
                reconnected on AES-128 so everyone can hear each other. It&apos;s still end-to-end
                encrypted, and it stays on AES-128 until the call ends.
              </Text>
              <Button variant="Primary" radii="400" onClick={() => setNotice(false)}>
                <Text as="span" size="B400">
                  Got it
                </Text>
              </Button>
            </Box>
          </Dialog>
        </FocusTrap>
      </OverlayCenter>
    </Overlay>
  );
}

import React, { useCallback, useRef, useState } from 'react';
import FocusTrap from 'focus-trap-react';
import {
  Box,
  Button,
  Checkbox,
  color,
  config,
  Dialog,
  Overlay,
  OverlayBackdrop,
  OverlayCenter,
  Spinner,
  Text,
  toRem,
} from 'folds';
import { AuthDict, MatrixError } from 'matrix-js-sdk';
import { SequenceCard } from '../../../components/sequence-card';
import { SequenceCardStyle } from '../styles.css';
import { SettingTile } from '../../../components/setting-tile';
import { useMatrixClient } from '../../../hooks/useMatrixClient';
import { AsyncState, AsyncStatus, useAsync } from '../../../hooks/useAsyncCallback';
import { useUIAMatrixError } from '../../../hooks/useUIAFlows';
import { ActionUIA, ActionUIAFlowsLoader } from '../../../components/ActionUIA';
import { getMxIdServer } from '../../../utils/matrix';
import { logoutClient } from '../../../../client/initMatrix';
import { stopPropagation } from '../../../utils/keyboard';

// Asks twice, then has the homeserver deactivate the account for good.
function DeleteAccountDialog({ onClose }: { onClose: () => void }) {
  const mx = useMatrixClient();
  const server = getMxIdServer(mx.getSafeUserId()) ?? 'your homeserver';
  const dialogRef = useRef<HTMLDivElement>(null);
  const [understood, setUnderstood] = useState(false);
  const [erase, setErase] = useState(false);
  const [state, setState] = useState<AsyncState<void, MatrixError>>({
    status: AsyncStatus.Idle,
  });

  const deactivate = useAsync(
    useCallback(
      async (authDict?: AuthDict) => {
        await mx.deactivateAccount(authDict, erase);
      },
      [mx, erase]
    ),
    useCallback(
      (next: typeof state) => {
        setState(next);
        // The account is gone, so this device's data goes too.
        if (next.status === AsyncStatus.Success) logoutClient(mx);
      },
      [mx]
    )
  );
  const [authData, error] = useUIAMatrixError(
    state.status === AsyncStatus.Error ? state.error : undefined
  );
  const busy =
    state.status === AsyncStatus.Loading ||
    state.status === AsyncStatus.Success ||
    authData !== undefined;

  return (
    <Overlay open backdrop={<OverlayBackdrop />}>
      <OverlayCenter>
        <FocusTrap
          focusTrapOptions={{
            initialFocus: false,
            // Every button is disabled while it finishes, so focus needs somewhere to go.
            fallbackFocus: () => dialogRef.current ?? document.body,
            onDeactivate: onClose,
            clickOutsideDeactivates: true,
            escapeDeactivates: stopPropagation,
          }}
        >
          <Dialog
            ref={dialogRef}
            tabIndex={-1}
            variant="Surface"
            style={{ width: `min(${toRem(420)}, calc(100vw - ${toRem(32)}))` }}
          >
            <Box direction="Column" gap="400" style={{ padding: config.space.S500 }}>
              <Text size="H4">Delete your account?</Text>
              <Text size="T300">
                This will delete your account from <b>{server}</b>. It can&apos;t be undone.
              </Text>
              <Box
                as="ul"
                direction="Column"
                gap="200"
                style={{ margin: 0, paddingLeft: config.space.S500 }}
              >
                <Text as="li" size="T300">
                  You&apos;ll be signed out everywhere and can&apos;t sign in again.
                </Text>
                <Text as="li" size="T300">
                  Your username can&apos;t be used again, by you or anyone else.
                </Text>
                <Text as="li" size="T300">
                  Encrypted messages and keys are lost for good.
                </Text>
              </Box>
              <Box as="label" gap="300" alignItems="Center" style={{ cursor: 'pointer' }}>
                <Checkbox
                  checked={erase}
                  onClick={() => setErase(!erase)}
                  variant="Critical"
                  size="300"
                  disabled={busy}
                />
                <Text size="T300">Also ask the server to erase my messages</Text>
              </Box>
              <Box as="label" gap="300" alignItems="Center" style={{ cursor: 'pointer' }}>
                <Checkbox
                  checked={understood}
                  onClick={() => setUnderstood(!understood)}
                  variant="Critical"
                  size="300"
                  disabled={busy}
                />
                <Text size="T300">I understand this is permanent</Text>
              </Box>
              {error && (
                <Text size="T200" style={{ color: color.Critical.Main }}>
                  <b>{error.message || "Couldn't delete your account."}</b>
                </Text>
              )}
              {authData && (
                <ActionUIAFlowsLoader
                  authData={authData}
                  unsupported={() => (
                    <Text size="T200" style={{ color: color.Critical.Main }}>
                      Your homeserver needs a sign-in step this app can&apos;t do. Delete the
                      account from your homeserver&apos;s own website instead.
                    </Text>
                  )}
                >
                  {(ongoingFlow) => (
                    <ActionUIA
                      authData={authData}
                      ongoingFlow={ongoingFlow}
                      action={deactivate}
                      onCancel={() => setState({ status: AsyncStatus.Idle })}
                    />
                  )}
                </ActionUIAFlowsLoader>
              )}
              <Box direction="Column" gap="200">
                <Button
                  variant="Critical"
                  radii="400"
                  disabled={!understood || busy}
                  onClick={() => deactivate()}
                  before={busy && <Spinner size="100" variant="Critical" fill="Solid" />}
                >
                  <Text size="B400">Delete Account</Text>
                </Button>
                <Button
                  variant="Secondary"
                  fill="Soft"
                  radii="400"
                  disabled={busy}
                  onClick={onClose}
                >
                  <Text size="B400">Cancel</Text>
                </Button>
              </Box>
            </Box>
          </Dialog>
        </FocusTrap>
      </OverlayCenter>
    </Overlay>
  );
}

export function DeleteAccount() {
  const [open, setOpen] = useState(false);
  return (
    <Box direction="Column" gap="100">
      <Text size="L400">Danger Zone</Text>
      <SequenceCard className={SequenceCardStyle} variant="SurfaceVariant" direction="Column">
        <SettingTile
          title="Delete Account"
          description="Permanently delete your account from your homeserver."
          after={
            <Button
              size="300"
              variant="Critical"
              fill="Soft"
              radii="300"
              outlined
              onClick={() => setOpen(true)}
            >
              <Text size="B300">Delete Account</Text>
            </Button>
          }
        />
      </SequenceCard>
      {open && <DeleteAccountDialog onClose={() => setOpen(false)} />}
    </Box>
  );
}

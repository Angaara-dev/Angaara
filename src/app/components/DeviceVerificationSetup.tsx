import React, { FormEventHandler, forwardRef, useCallback, useState } from 'react';
import {
  Dialog,
  Header,
  Box,
  Text,
  IconButton,
  Icon,
  Icons,
  config,
  Button,
  Chip,
  color,
  Input,
  Spinner,
} from 'folds';
import FileSaver from 'file-saver';
import to from 'await-to-js';
import { AuthDict, IAuthData, MatrixError, UIAuthCallback } from 'matrix-js-sdk';
import { PasswordInput } from './password-input';
import { ContainerColor } from '../styles/ContainerColor.css';
import { copyToClipboard } from '../utils/dom';
import { AsyncStatus, useAsyncCallback } from '../hooks/useAsyncCallback';
import { clearSecretStorageKeys } from '../../client/secretStorageKeys';
import { ActionUIA, ActionUIAFlowsLoader } from './ActionUIA';
import { useMatrixClient } from '../hooks/useMatrixClient';
import { useAlive } from '../hooks/useAlive';

type UIACallback<T> = (
  authDict: AuthDict | null
) => Promise<[IAuthData, undefined] | [undefined, T]>;

type PerformAction<T> = (authDict: AuthDict | null) => Promise<T>;

type UIAAction<T> = {
  authData: IAuthData;
  callback: UIACallback<T>;
  cancelCallback: () => void;
};

function makeUIAAction<T>(
  authData: IAuthData,
  performAction: PerformAction<T>,
  resolve: (data: T) => void,
  reject: (error?: any) => void
): UIAAction<T> {
  const action: UIAAction<T> = {
    authData,
    callback: async (authDict) => {
      const [error, data] = await to<T, MatrixError | Error>(performAction(authDict));

      if (error instanceof MatrixError && error.httpStatus === 401) {
        return [error.data as IAuthData, undefined];
      }

      if (error) {
        reject(error);
        throw error;
      }

      resolve(data);
      return [undefined, data];
    },
    cancelCallback: reject,
  };

  return action;
}

const MIN_PASSPHRASE_LENGTH = 8;

type SetupVerificationProps = {
  onComplete: (recoveryKey: string) => void;
};
function SetupVerification({ onComplete }: SetupVerificationProps) {
  const mx = useMatrixClient();
  const alive = useAlive();

  const [uiaAction, setUIAAction] = useState<UIAAction<void>>();
  const [nextAuthData, setNextAuthData] = useState<IAuthData | null>(); // null means no next action.

  const handleAction = useCallback(
    async (authDict: AuthDict) => {
      if (!uiaAction) {
        throw new Error('Unexpected Error! UIA action is perform without data.');
      }
      if (alive()) {
        setNextAuthData(null);
      }
      const [authData] = await uiaAction.callback(authDict);

      if (alive() && authData) {
        setNextAuthData(authData);
      }
    },
    [uiaAction, alive]
  );

  const resetUIA = useCallback(() => {
    if (!alive()) return;
    setUIAAction(undefined);
    setNextAuthData(undefined);
  }, [alive]);

  const authUploadDeviceSigningKeys: UIAuthCallback<void> = useCallback(
    (makeRequest) =>
      new Promise<void>((resolve, reject) => {
        makeRequest(null)
          .then(() => {
            resolve();
            resetUIA();
          })
          .catch((error) => {
            if (error instanceof MatrixError && error.httpStatus === 401) {
              const authData = error.data as IAuthData;
              const action = makeUIAAction(
                authData,
                makeRequest as PerformAction<void>,
                resolve,
                (err) => {
                  resetUIA();
                  reject(err);
                }
              );
              if (alive()) {
                setUIAAction(action);
              } else {
                reject(new Error('Authentication failed! Failed to setup device verification.'));
              }
              return;
            }
            reject(error);
          });
      }),
    [alive, resetUIA]
  );

  const [formError, setFormError] = useState<string>();

  const [setupState, setup] = useAsyncCallback<void, Error, [string]>(
    useCallback(
      async (passphrase) => {
        const crypto = mx.getCrypto();
        if (!crypto) throw new Error('Unexpected Error! Crypto module not found!');

        const recoveryKeyData = await crypto.createRecoveryKeyFromPassphrase(passphrase);
        if (!recoveryKeyData.encodedPrivateKey) {
          throw new Error('Unexpected Error! Failed to create recovery key.');
        }
        clearSecretStorageKeys();

        await crypto.bootstrapSecretStorage({
          createSecretStorageKey: async () => recoveryKeyData,
          setupNewSecretStorage: true,
        });

        await crypto.bootstrapCrossSigning({
          authUploadDeviceSigningKeys,
          setupNewCrossSigning: true,
        });

        await crypto.resetKeyBackup();

        onComplete(recoveryKeyData.encodedPrivateKey);
      },
      [mx, onComplete, authUploadDeviceSigningKeys]
    )
  );

  const loading = setupState.status === AsyncStatus.Loading;

  const handleSubmit: FormEventHandler<HTMLFormElement> = (evt) => {
    evt.preventDefault();
    if (loading) return;

    const target = evt.target as HTMLFormElement | undefined;
    const passphrase = (target?.passphraseInput as HTMLInputElement | undefined)?.value ?? '';
    const confirm = (target?.confirmPassphraseInput as HTMLInputElement | undefined)?.value ?? '';

    if (/\s/.test(passphrase)) {
      setFormError('Passphrase cannot contain spaces.');
      return;
    }
    if (passphrase.length < MIN_PASSPHRASE_LENGTH) {
      setFormError(`Passphrase must be at least ${MIN_PASSPHRASE_LENGTH} characters.`);
      return;
    }
    if (passphrase !== confirm) {
      setFormError('Passphrases do not match.');
      return;
    }
    setFormError(undefined);
    setup(passphrase);
  };

  return (
    <Box as="form" onSubmit={handleSubmit} direction="Column" gap="400">
      <Text size="T300">
        Choose a <b>Passphrase</b> to unlock your encrypted messages on new devices. You will also
        get a backup <b>Recovery Code</b> in the next step.
      </Text>
      <Box direction="Column" gap="100">
        <Text size="L400">Passphrase</Text>
        <PasswordInput name="passphraseInput" size="400" readOnly={loading} required />
        <Text size="T200" priority="300">
          No spaces, at least {MIN_PASSPHRASE_LENGTH} characters.
        </Text>
      </Box>
      <Box direction="Column" gap="100">
        <Text size="L400">Confirm Passphrase</Text>
        <PasswordInput name="confirmPassphraseInput" size="400" readOnly={loading} required />
      </Box>
      <Box
        className={ContainerColor({ variant: 'Warning' })}
        style={{ padding: config.space.S300, borderRadius: config.radii.R400 }}
        direction="Column"
        gap="100"
      >
        <Text size="L400">Don&apos;t forget this passphrase!</Text>
        <Text size="T200">
          If you lose both your passphrase and your recovery code while logged out of every device,
          your encrypted messages are gone for good. Nobody can recover them, not even the server.
        </Text>
      </Box>
      <Button
        type="submit"
        disabled={loading}
        before={loading && <Spinner size="200" variant="Primary" fill="Solid" />}
      >
        <Text size="B400">Continue</Text>
      </Button>
      {formError && (
        <Text size="T200" style={{ color: color.Critical.Main }}>
          <b>{formError}</b>
        </Text>
      )}
      {setupState.status === AsyncStatus.Error && (
        <Text size="T200" style={{ color: color.Critical.Main }}>
          <b>{setupState.error ? setupState.error.message : 'Unexpected Error!'}</b>
        </Text>
      )}
      {nextAuthData !== null && uiaAction && (
        <ActionUIAFlowsLoader
          authData={nextAuthData ?? uiaAction.authData}
          unsupported={() => (
            <Text size="T200">
              Authentication steps to perform this action are not supported by client.
            </Text>
          )}
        >
          {(ongoingFlow) => (
            <ActionUIA
              authData={nextAuthData ?? uiaAction.authData}
              ongoingFlow={ongoingFlow}
              action={handleAction}
              onCancel={uiaAction.cancelCallback}
            />
          )}
        </ActionUIAFlowsLoader>
      )}
    </Box>
  );
}

type RecoveryKeyDisplayProps = {
  recoveryKey: string;
  onContinue: () => void;
};
function RecoveryKeyDisplay({ recoveryKey, onContinue }: RecoveryKeyDisplayProps) {
  const [show, setShow] = useState(false);

  const handleCopy = () => {
    copyToClipboard(recoveryKey);
  };

  const handleDownload = () => {
    const blob = new Blob([recoveryKey], {
      type: 'text/plain;charset=us-ascii',
    });
    FileSaver.saveAs(blob, 'recovery-key.txt');
  };

  const safeToDisplayKey = show ? recoveryKey : recoveryKey.replace(/[^\s]/g, '*');

  return (
    <Box direction="Column" gap="400">
      <Text size="T300">
        This is your <b>Recovery Code</b>. It works if you ever forget your passphrase. Save it
        somewhere safe, like a password manager.
      </Text>
      <Box direction="Column" gap="100">
        <Text size="L400">Recovery Code</Text>
        <Box
          className={ContainerColor({ variant: 'SurfaceVariant' })}
          style={{
            padding: config.space.S300,
            borderRadius: config.radii.R400,
          }}
          alignItems="Center"
          justifyContent="Center"
          gap="400"
        >
          <Text style={{ fontFamily: 'monospace' }} size="T200" priority="300">
            {safeToDisplayKey}
          </Text>
          <Chip onClick={() => setShow(!show)} variant="Secondary" radii="Pill">
            <Text size="B300">{show ? 'Hide' : 'Show'}</Text>
          </Chip>
        </Box>
      </Box>
      <Box direction="Column" gap="200">
        <Button onClick={handleCopy}>
          <Text size="B400">Copy</Text>
        </Button>
        <Button onClick={handleDownload} fill="Soft">
          <Text size="B400">Download</Text>
        </Button>
        <Button onClick={onContinue} variant="Success">
          <Text size="B400">OK, I&apos;ve Saved It</Text>
        </Button>
      </Box>
    </Box>
  );
}

const normalizeRecoveryKey = (key: string) => key.replace(/\s/g, '');

type RecoveryKeyConfirmProps = {
  recoveryKey: string;
  onConfirmed: () => void;
  onShowAgain: () => void;
};
function RecoveryKeyConfirm({ recoveryKey, onConfirmed, onShowAgain }: RecoveryKeyConfirmProps) {
  const [error, setError] = useState(false);

  const handleSubmit: FormEventHandler<HTMLFormElement> = (evt) => {
    evt.preventDefault();
    const target = evt.target as HTMLFormElement | undefined;
    const value = (target?.recoveryCodeInput as HTMLInputElement | undefined)?.value ?? '';
    if (normalizeRecoveryKey(value) === normalizeRecoveryKey(recoveryKey)) {
      onConfirmed();
      return;
    }
    setError(true);
  };

  return (
    <Box as="form" onSubmit={handleSubmit} direction="Column" gap="400">
      <Text size="T300">
        Let&apos;s make sure you saved it. Enter your <b>Recovery Code</b> below.
      </Text>
      <Box direction="Column" gap="100">
        <Text size="L400">Recovery Code</Text>
        <Input
          name="recoveryCodeInput"
          size="400"
          variant="Background"
          autoComplete="off"
          spellCheck={false}
          style={{ fontFamily: 'monospace' }}
          onChange={() => setError(false)}
          required
        />
      </Box>
      {error && (
        <Text size="T200" style={{ color: color.Critical.Main }}>
          <b>That code doesn&apos;t match. Check for typos, or view it again.</b>
        </Text>
      )}
      <Box direction="Column" gap="200">
        <Button type="submit">
          <Text size="B400">Confirm</Text>
        </Button>
        <Button type="button" onClick={onShowAgain} fill="Soft">
          <Text size="B400">Show My Code Again</Text>
        </Button>
      </Box>
    </Box>
  );
}

type SetupStep = 'setup' | 'display' | 'confirm' | 'done';

// Close is hidden mid-flow so the recovery code can't be skipped before it's confirmed.
function useSetupFlow(onClose: () => void) {
  const [step, setStep] = useState<SetupStep>('setup');
  const [recoveryKey, setRecoveryKey] = useState<string>();

  const handleComplete = useCallback((key: string) => {
    setRecoveryKey(key);
    setStep('display');
  }, []);

  let body: React.ReactNode;
  if (step === 'setup' || !recoveryKey) {
    body = <SetupVerification onComplete={handleComplete} />;
  } else if (step === 'display') {
    body = <RecoveryKeyDisplay recoveryKey={recoveryKey} onContinue={() => setStep('confirm')} />;
  } else if (step === 'confirm') {
    body = (
      <RecoveryKeyConfirm
        recoveryKey={recoveryKey}
        onConfirmed={() => setStep('done')}
        onShowAgain={() => setStep('display')}
      />
    );
  } else {
    body = (
      <Box direction="Column" gap="400">
        <Text size="H1">🔐</Text>
        <Text size="T300">
          You&apos;re all set! Your messages are backed up and you can unlock them with your
          passphrase or recovery code.
        </Text>
        <Button onClick={onClose}>
          <Text size="B400">Done</Text>
        </Button>
      </Box>
    );
  }

  return { body, canClose: step === 'setup' || step === 'done' };
}

type DeviceVerificationSetupProps = {
  onCancel: () => void;
};
export const DeviceVerificationSetup = forwardRef<HTMLDivElement, DeviceVerificationSetupProps>(
  ({ onCancel }, ref) => {
    const { body, canClose } = useSetupFlow(onCancel);

    return (
      <Dialog ref={ref}>
        <Header
          style={{
            padding: `0 ${config.space.S200} 0 ${config.space.S400}`,
            borderBottomWidth: config.borderWidth.B300,
          }}
          variant="Surface"
          size="500"
        >
          <Box grow="Yes">
            <Text size="H4">Setup Device Verification</Text>
          </Box>
          {canClose && (
            <IconButton size="300" radii="300" onClick={onCancel}>
              <Icon src={Icons.Cross} />
            </IconButton>
          )}
        </Header>
        <Box style={{ padding: config.space.S400 }} direction="Column" gap="400">
          {body}
        </Box>
      </Dialog>
    );
  }
);
type DeviceVerificationResetProps = {
  onCancel: () => void;
};
export const DeviceVerificationReset = forwardRef<HTMLDivElement, DeviceVerificationResetProps>(
  ({ onCancel }, ref) => {
    const [reset, setReset] = useState(false);
    const { body, canClose } = useSetupFlow(onCancel);

    return (
      <Dialog ref={ref}>
        <Header
          style={{
            padding: `0 ${config.space.S200} 0 ${config.space.S400}`,
            borderBottomWidth: config.borderWidth.B300,
          }}
          variant="Surface"
          size="500"
        >
          <Box grow="Yes">
            <Text size="H4">Reset Device Verification</Text>
          </Box>
          {(!reset || canClose) && (
            <IconButton size="300" radii="300" onClick={onCancel}>
              <Icon src={Icons.Cross} />
            </IconButton>
          )}
        </Header>
        {reset ? (
          <Box style={{ padding: config.space.S400 }} direction="Column" gap="400">
            {body}
          </Box>
        ) : (
          <Box style={{ padding: config.space.S400 }} direction="Column" gap="400">
            <Box direction="Column" gap="200">
              <Text size="H1">✋🧑‍🚒🤚</Text>
              <Text size="T300">Resetting device verification is permanent.</Text>
              <Text size="T300">
                Anyone you have verified with will see security alerts and your encryption backup
                will be lost. You almost certainly do not want to do this, unless you have lost{' '}
                <b>Recovery Key</b> or <b>Recovery Passphrase</b> and every device you can verify
                from.
              </Text>
            </Box>
            <Button variant="Critical" onClick={() => setReset(true)}>
              <Text size="B400">Reset</Text>
            </Button>
          </Box>
        )}
      </Dialog>
    );
  }
);

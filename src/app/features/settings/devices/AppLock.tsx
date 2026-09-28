import React, { FormEvent, useCallback, useEffect, useState } from 'react';
import { Box, Button, color, Input, Spinner, Text } from 'folds';
import { SettingTile } from '../../../components/setting-tile';
import { useMatrixClient } from '../../../hooks/useMatrixClient';
import {
  AppLockState,
  getAppLockState,
  setAppLockPassword,
  turnOffAppLock,
} from '../../../../client/storeKey';

const MIN_PASSWORD = 8;

function PasswordInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <Box direction="Column" gap="100">
      <Text size="L400">{label}</Text>
      <Input
        type="password"
        size="400"
        variant="Background"
        radii="300"
        value={value}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
      />
    </Box>
  );
}

// In Settings, under Devices: lock this device's encryption keys behind a password.
export function AppLock() {
  const mx = useMatrixClient();
  const userId = mx.getSafeUserId();
  const deviceId = mx.getDeviceId() ?? '';
  const [state, setState] = useState<AppLockState>();
  const [form, setForm] = useState<'set' | 'off'>();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  const refresh = useCallback(
    () => getAppLockState(userId, deviceId).then(setState),
    [userId, deviceId]
  );
  useEffect(() => {
    refresh();
  }, [refresh]);

  const open = (next?: 'set' | 'off') => {
    setForm(next);
    setPassword('');
    setConfirm('');
    setError(undefined);
  };

  const submit = async (evt: FormEvent) => {
    evt.preventDefault();
    if (form === 'set') {
      if (password.length < MIN_PASSWORD) {
        setError(`Use at least ${MIN_PASSWORD} characters.`);
        return;
      }
      if (password !== confirm) {
        setError("The passwords don't match.");
        return;
      }
    }
    setBusy(true);
    setError(undefined);
    try {
      if (form === 'set') await setAppLockPassword(userId, deviceId, password);
      else await turnOffAppLock(userId, deviceId, password);
      open(undefined);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  };

  let description = 'Ask for a password before your encrypted chats open on this device.';
  if (state === 'legacy') {
    description =
      "This device's keys were saved before App Lock existed. To use it, sign out and back in on this device, with your recovery key ready to restore your messages.";
  } else if (state === 'on') {
    description =
      'On. Angaara asks for your password once per browser session. Forgot it? Sign out and back in with your recovery key.';
  }

  let actions = null;
  if (state === 'off') {
    actions = (
      <Button size="300" variant="Primary" radii="300" onClick={() => open('set')}>
        <Text size="B300">Turn On</Text>
      </Button>
    );
  } else if (state === 'on') {
    actions = (
      <Box gap="200">
        <Button size="300" variant="Secondary" radii="300" onClick={() => open('set')}>
          <Text size="B300">Change Password</Text>
        </Button>
        <Button size="300" variant="Critical" fill="None" radii="300" onClick={() => open('off')}>
          <Text size="B300">Turn Off</Text>
        </Button>
      </Box>
    );
  }

  return (
    <SettingTile
      title="App Lock"
      description={description}
      after={state === undefined ? <Spinner variant="Secondary" size="200" /> : !form && actions}
    >
      {form && (
        <Box as="form" direction="Column" gap="300" onSubmit={submit}>
          {form === 'set' ? (
            <>
              <PasswordInput label="New Password" value={password} onChange={setPassword} />
              <PasswordInput label="Confirm Password" value={confirm} onChange={setConfirm} />
            </>
          ) : (
            <PasswordInput label="Current Password" value={password} onChange={setPassword} />
          )}
          {error && (
            <Text size="T200" style={{ color: color.Critical.Main }}>
              {error}
            </Text>
          )}
          <Box gap="200">
            <Button
              type="submit"
              size="300"
              radii="300"
              variant={form === 'off' ? 'Critical' : 'Primary'}
              disabled={busy || !password}
              before={busy ? <Spinner size="100" variant="Secondary" /> : undefined}
            >
              <Text size="B300">{form === 'off' ? 'Turn Off App Lock' : 'Save Password'}</Text>
            </Button>
            <Button
              type="button"
              size="300"
              radii="300"
              variant="Secondary"
              fill="None"
              onClick={() => open(undefined)}
            >
              <Text size="B300">Cancel</Text>
            </Button>
          </Box>
        </Box>
      )}
    </SettingTile>
  );
}

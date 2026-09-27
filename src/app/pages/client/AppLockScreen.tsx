import React, { FormEvent, useState } from 'react';
import { Box, Button, color, config, Icon, Icons, Input, Spinner, Text, toRem } from 'folds';
import { SplashScreen } from '../../components/splash-screen';
import { getFallbackSession } from '../../state/sessions';
import { unlockApp } from '../../../client/storeKey';
import { clearLoginData } from '../../../client/initMatrix';

// Best effort: end the session on the server too, so the old device doesn't linger.
const signOutLockedDevice = async () => {
  const session = getFallbackSession();
  if (session) {
    await fetch(`${session.baseUrl.replace(/\/$/, '')}/_matrix/client/v3/logout`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${session.accessToken}` },
    }).catch(() => undefined);
  }
  await clearLoginData();
};

// Asked before the app loads when app lock is on and this browser session isn't unlocked yet.
export function AppLockScreen({ onUnlocked }: { onUnlocked: () => void }) {
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [forgot, setForgot] = useState(false);

  const submit = async (evt: FormEvent) => {
    evt.preventDefault();
    const session = getFallbackSession();
    if (!session || !password) return;
    setBusy(true);
    setError(undefined);
    try {
      await unlockApp(session.userId, session.deviceId, password);
      onUnlocked();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't unlock.");
      setBusy(false);
    }
  };

  return (
    <SplashScreen>
      <Box
        grow="Yes"
        alignItems="Center"
        justifyContent="Center"
        style={{ padding: config.space.S400 }}
      >
        <Box
          direction="Column"
          gap="400"
          style={{
            width: '100%',
            maxWidth: toRem(380),
            padding: config.space.S500,
            borderRadius: config.radii.R500,
            background: color.Surface.Container,
            color: color.Surface.OnContainer,
          }}
        >
          <Box gap="200" alignItems="Center">
            <Icon src={Icons.Lock} size="200" />
            <Text size="H4">Angaara is locked</Text>
          </Box>
          {forgot ? (
            <>
              <Text size="T300">
                Without the password, the keys on this device can&apos;t be opened. Sign out of this
                device, then sign back in and enter your recovery key to get your encrypted messages
                back.
              </Text>
              <Button variant="Critical" onClick={signOutLockedDevice}>
                <Text size="B400">Sign Out of This Device</Text>
              </Button>
              <Button variant="Secondary" fill="None" onClick={() => setForgot(false)}>
                <Text size="B400">Back</Text>
              </Button>
            </>
          ) : (
            <>
              <Box as="form" direction="Column" gap="300" onSubmit={submit}>
                <Text size="T300">Enter your password to access your encrypted chats.</Text>
                <Input
                  type="password"
                  size="500"
                  variant="Background"
                  autoFocus
                  autoComplete="current-password"
                  value={password}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
                />
                {error && (
                  <Text size="T200" style={{ color: color.Critical.Main }}>
                    {error}
                  </Text>
                )}
                <Button
                  type="submit"
                  variant="Primary"
                  disabled={busy || !password}
                  before={busy ? <Spinner size="100" variant="Primary" fill="Solid" /> : undefined}
                >
                  <Text size="B400">Unlock</Text>
                </Button>
              </Box>
              <Button variant="Secondary" fill="None" size="300" onClick={() => setForgot(true)}>
                <Text size="B300">Forgot your password?</Text>
              </Button>
            </>
          )}
        </Box>
      </Box>
    </SplashScreen>
  );
}

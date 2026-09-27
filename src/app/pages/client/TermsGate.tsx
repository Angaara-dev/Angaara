import React, { ReactNode, useState } from 'react';
import { Box, Button, Checkbox, color, config, Spinner, Text, toRem } from 'folds';
import { SplashScreen } from '../../components/splash-screen';
import { useMatrixClient } from '../../hooks/useMatrixClient';
import { useAccountData } from '../../hooks/useAccountData';
import { BRAND_NAME, TERMS_URL, TERMS_VERSION } from '../../brand';

// Stored in account data so agreeing once covers every device.
const TERMS_KEY = 'io.angaara.terms';

function Point({ children }: { children: ReactNode }) {
  return (
    <Text as="li" size="T300">
      {children}
    </Text>
  );
}

export function TermsGate({ children }: { children: ReactNode }) {
  const mx = useMatrixClient();
  const agreed = useAccountData(TERMS_KEY)?.getContent()?.version === TERMS_VERSION;
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  const agree = async () => {
    setBusy(true);
    setError(undefined);
    try {
      await mx.setAccountData(
        TERMS_KEY as never,
        { version: TERMS_VERSION, ts: Date.now() } as never
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save. Try again.");
      setBusy(false);
    }
  };

  if (agreed) return children as JSX.Element;

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
            maxWidth: toRem(440),
            padding: config.space.S500,
            borderRadius: config.radii.R500,
            background: color.Surface.Container,
            color: color.Surface.OnContainer,
          }}
        >
          <Text size="H4">Before you continue</Text>
          <Text size="T300">
            {BRAND_NAME} uses end-to-end encryption. That keeps your chats private, and it also
            means:
          </Text>
          <Box
            as="ul"
            direction="Column"
            gap="200"
            style={{ margin: 0, paddingLeft: config.space.S500 }}
          >
            <Point>
              <b>Nobody can recover your keys or encrypted messages</b>, not {BRAND_NAME}, not your
              homeserver, not anyone.
            </Point>
            <Point>
              If you sign out everywhere and lose your recovery key, your encrypted history is gone
              for good. A password reset won&apos;t bring it back.
            </Point>
            <Point>
              Your account lives on your homeserver, which has its own terms. {BRAND_NAME} is only
              the app.
            </Point>
          </Box>
          <Box as="label" gap="300" alignItems="Center" style={{ cursor: 'pointer' }}>
            <Checkbox
              checked={checked}
              onClick={() => setChecked(!checked)}
              variant="Primary"
              size="300"
              disabled={busy}
            />
            <Text size="T300">
              I understand, and I agree to the{' '}
              <a href={TERMS_URL} target="_blank" rel="noreferrer">
                {BRAND_NAME} Terms
              </a>
              .
            </Text>
          </Box>
          {error && (
            <Text size="T200" style={{ color: color.Critical.Main }}>
              <b>{error}</b>
            </Text>
          )}
          <Button
            variant="Primary"
            disabled={!checked || busy}
            onClick={agree}
            before={busy && <Spinner size="100" variant="Primary" fill="Solid" />}
          >
            <Text size="B400">Continue</Text>
          </Button>
        </Box>
      </Box>
    </SplashScreen>
  );
}

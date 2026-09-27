import React, { useEffect, useState } from 'react';
import { Box, Text } from 'folds';
import { AngaaraLogo } from '../angaara-logo';
import * as css from './SplashScreen.css';

const QUIPS = [
  'Heating up....',
  'Stoking the fire....',
  'Blowing on the embers....',
  'Decrypting your drama....',
  'Summoning the homeserver....',
  'Counting your unread messages. Yikes....',
  'Polishing the pixels....',
  'Waking up the servers, they were napping....',
  'Rolling the encryption dice....',
  'Adding more coal....',
];

const randomQuip = (not?: string) => {
  const pool = QUIPS.filter((q) => q !== not);
  return pool[Math.floor(Math.random() * pool.length)];
};

// Glowing logo plus a status line; without a label it cycles through silly lines.
export function SplashLoading({ label }: { label?: string }) {
  const [quip, setQuip] = useState(() => randomQuip());
  useEffect(() => {
    if (label) return undefined;
    const timer = window.setInterval(() => setQuip((q) => randomQuip(q)), 3500);
    return () => window.clearInterval(timer);
  }, [label]);

  return (
    <Box direction="Column" grow="Yes" alignItems="Center" justifyContent="Center" gap="500">
      <AngaaraLogo size={72} animated />
      <Text className={css.SplashStatus} size="T400" align="Center" aria-live="polite">
        {label ?? quip}
      </Text>
    </Box>
  );
}

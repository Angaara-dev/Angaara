import React, { useEffect, useState } from 'react';
import { Box, Text } from 'folds';
import { AngaaraLogo } from '../angaara-logo';
import * as css from './SplashScreen.css';

const QUIPS = [
  'Heating up....',
  'Stoking the fire....',
  'Blowing on the embers....',
  'Summoning the homeserver....',
  'Polishing the pixels....',
  'Waking up the servers, they were napping....',
  'Rolling the encryption dice....',
  'Adding more coal....',
];

// Only make sense once someone is signed in with chats to load.
const SIGNED_IN_QUIPS = ['Decrypting your drama....', 'Counting your unread messages. Yikes....'];

const randomQuip = (signedIn: boolean, not?: string) => {
  const pool = (signedIn ? [...QUIPS, ...SIGNED_IN_QUIPS] : QUIPS).filter((q) => q !== not);
  return pool[Math.floor(Math.random() * pool.length)];
};

// Glowing logo plus a status line; without a label it cycles through silly lines.
export function SplashLoading({ label, signedIn = false }: { label?: string; signedIn?: boolean }) {
  const [quip, setQuip] = useState(() => randomQuip(signedIn));
  useEffect(() => {
    if (label) return undefined;
    const timer = window.setInterval(() => setQuip((q) => randomQuip(signedIn, q)), 3500);
    return () => window.clearInterval(timer);
  }, [label, signedIn]);

  return (
    <Box direction="Column" grow="Yes" alignItems="Center" justifyContent="Center" gap="500">
      <AngaaraLogo size={72} animated />
      <Text className={css.SplashStatus} size="T400" align="Center" aria-live="polite">
        {label ?? quip}
      </Text>
    </Box>
  );
}

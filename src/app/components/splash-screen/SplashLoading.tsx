import React, { ReactNode, useEffect, useState } from 'react';
import { Box, Text } from 'folds';
import { AngaaraLogo } from '../angaara-logo';
import { XP_PERKS } from '../../../client/xp';
import * as css from './SplashScreen.css';

const FIRST_QUIP = 'Heating up....';
const QUIPS = [
  FIRST_QUIP,
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

const TIPS: ReactNode[] = [
  <>
    Chat in servers to earn XP and unlock <b>animated banners</b>.
  </>,
  <>
    Something broken? <b>Report a Bug</b> is in the Home tab.
  </>,
  <>
    Server admins can turn on <b>moderator commands</b> like .ban in AutoMod settings.
  </>,
  <>
    Your profile panel can be a GIF from <b>{XP_PERKS.panelGif.toLocaleString()} XP</b>.
  </>,
  <>
    <b>Profile colours</b> unlock at {XP_PERKS.profileTheme.toLocaleString()} XP.
  </>,
];

const LINE_MS = 5500;

type Line = { key: number; tip: boolean; text: ReactNode };

const pick = <T,>(pool: T[], not?: T) => {
  const options = pool.filter((item) => item !== not);
  return options[Math.floor(Math.random() * options.length)];
};

// Quips and tips take turns, starting with the same line the page shows before the app loads.
const nextLine = (prev: Line, signedIn: boolean): Line => {
  const key = prev.key + 1;
  if (!prev.tip) return { key, tip: true, text: pick(TIPS, prev.text) };
  const quips = signedIn ? [...QUIPS, ...SIGNED_IN_QUIPS] : QUIPS;
  return { key, tip: false, text: pick(quips) };
};

// The embers behind this live in index.html, so they keep going while the app takes over.
const useBootEmbers = () => {
  useEffect(() => {
    const { body } = document;
    body.dataset.splash = String(Number(body.dataset.splash ?? 0) + 1);
    return () => {
      const left = Number(body.dataset.splash ?? 1) - 1;
      if (left > 0) body.dataset.splash = String(left);
      else delete body.dataset.splash;
    };
  }, []);
};

export function SplashLoading({ label, signedIn = false }: { label?: string; signedIn?: boolean }) {
  useBootEmbers();
  const [line, setLine] = useState<Line>({ key: 0, tip: false, text: FIRST_QUIP });
  useEffect(() => {
    if (label) return undefined;
    const timer = window.setInterval(() => setLine((l) => nextLine(l, signedIn)), LINE_MS);
    return () => window.clearInterval(timer);
  }, [label, signedIn]);

  return (
    <Box
      data-splash-loading
      direction="Column"
      grow="Yes"
      alignItems="Center"
      justifyContent="Center"
      gap="500"
    >
      <div className={css.Halo}>
        <AngaaraLogo size={72} animated />
      </div>
      <Text
        key={label ? 'label' : line.key}
        className={css.SplashStatus}
        size="T400"
        align="Center"
        aria-live="polite"
      >
        {!label && line.tip && <span className={css.Tip}>TIP</span>}
        {label ?? line.text}
      </Text>
    </Box>
  );
}

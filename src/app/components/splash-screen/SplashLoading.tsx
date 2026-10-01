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

const FACTS: ReactNode[] = [
  <>
    Encrypted chats are locked on your device. The server only ever sees <b>scrambled text</b>.
  </>,
  <>
    Message keys move forward as you chat, so a leaked key <b>can&apos;t unlock older messages</b>.
  </>,
  <>
    Your encryption runs on <b>Rust</b> code, compiled to run right in your browser.
  </>,
  <>
    Verifying a device means matching <b>7 emojis</b> on both screens. Spot a difference? Don&apos;t
    trust it.
  </>,
  <>
    Lose your <b>security key</b> and nobody can recover your encrypted history. Not even us.
  </>,
  <>
    <b>Check File</b> scans happen on your device. Only the file&apos;s fingerprint ever leaves it.
  </>,
  <>
    Angaara is <b>open source</b>, so anyone can read the code that guards your chats.
  </>,
];

const FIRST_LINE_MS = 1500;
const LINE_MS = 5500;

type Line = { key: number; label?: 'TIP' | 'FACT'; text: ReactNode };

const pick = <T,>(pool: T[]) => pool[Math.floor(Math.random() * pool.length)];

// Quips take turns with tips and facts, starting with the line the page shows before the app loads.
const nextLine = (prev: Line, signedIn: boolean): Line => {
  const key = prev.key + 1;
  if (!prev.label) {
    const fact = Math.random() < 0.5;
    return { key, label: fact ? 'FACT' : 'TIP', text: pick(fact ? FACTS : TIPS) };
  }
  const quips = signedIn ? [...QUIPS, ...SIGNED_IN_QUIPS] : QUIPS;
  return { key, text: pick(quips) };
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
  const [line, setLine] = useState<Line>({ key: 0, text: FIRST_QUIP });
  useEffect(() => {
    if (label) return undefined;
    // The first tip comes quickly, since most loads finish within a few seconds.
    const timer = window.setTimeout(
      () => setLine((l) => nextLine(l, signedIn)),
      line.key === 0 ? FIRST_LINE_MS : LINE_MS
    );
    return () => window.clearTimeout(timer);
  }, [label, signedIn, line.key]);

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
        {!label && line.label && <span className={css.Tip}>{line.label}</span>}
        {label ?? line.text}
      </Text>
    </Box>
  );
}

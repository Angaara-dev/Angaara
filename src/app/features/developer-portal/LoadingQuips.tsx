import React, { useEffect, useState } from 'react';
import { Box, Spinner, Text } from 'folds';

const QUIPS = [
  'Loading......',
  'Destroying RAM to load your page....',
  'Summoning the semicolons....',
  'Convincing the compiler to like you....',
  'Feeding the hamsters that run the servers....',
  'Untangling spaghetti code....',
  'Downloading more RAM....',
  'Warming up the embers....',
  'Asking Stack Overflow for help....',
  'Borrowing CPU cycles from your fridge....',
  'Reticulating splines....',
  'Almost there, probably....',
];

const randomQuip = (not?: string) => {
  const pool = QUIPS.filter((q) => q !== not);
  return pool[Math.floor(Math.random() * pool.length)];
};

export function LoadingQuips() {
  const [quip, setQuip] = useState(QUIPS[0]);
  useEffect(() => {
    const timer = window.setInterval(() => setQuip((q) => randomQuip(q)), 30000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <Box
      grow="Yes"
      direction="Column"
      alignItems="Center"
      justifyContent="Center"
      gap="300"
      style={{ height: '100%', padding: '1rem' }}
    >
      <Spinner size="400" variant="Secondary" />
      <Text size="T300" priority="300" align="Center" aria-live="polite">
        {quip}
      </Text>
    </Box>
  );
}

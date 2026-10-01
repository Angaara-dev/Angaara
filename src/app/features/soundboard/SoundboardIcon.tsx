import React from 'react';

// A speaker with a sparkle, drawn on the same 24px grid as the folds icons.
export function SoundboardIcon(filled?: boolean) {
  return (
    <>
      <path
        d="M4 9.5h3l4.5-4v13l-4.5-4H4z"
        fill={filled ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="M15 10a3.6 3.6 0 0 1 0 5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path d="M18.5 3.5l.8 1.9 1.9.8-1.9.8-.8 1.9-.8-1.9-1.9-.8 1.9-.8z" fill="currentColor" />
    </>
  );
}

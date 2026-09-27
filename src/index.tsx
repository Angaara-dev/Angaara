/* eslint-disable import/first */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { enableMapSet } from 'immer';
import '@fontsource/inter/variable.css';
import 'folds/dist/style.css';
import { configClass, varsClass } from 'folds';

enableMapSet();

import './index.css';

import { trimTrailingSlash } from './app/utils/common';
import App from './app/pages/App';

// import i18n (needs to be bundled ;))
import './app/i18n';
import { pushSessionToSW } from './sw-session';
import { getFallbackSession } from './app/state/sessions';
import { installBackClosesPanels } from './app/utils/backClosesPanels';
import { installPageShiftGuard } from './app/utils/pageShiftGuard';

document.body.classList.add(configClass, varsClass);

// Hides the browser's right-click menu like a desktop app, but keeps it for typing and copying.
document.addEventListener('contextmenu', (evt) => {
  const target = evt.target as HTMLElement | null;
  if (target?.closest('input, textarea, [contenteditable="true"]')) return;
  if (window.getSelection()?.toString()) return;
  evt.preventDefault();
});

// Register Service Worker
if ('serviceWorker' in navigator) {
  const swUrl =
    import.meta.env.MODE === 'production'
      ? `${trimTrailingSlash(import.meta.env.BASE_URL)}/sw.js`
      : `/dev-sw.js?dev-sw`;

  const sendSessionToSW = () => {
    const session = getFallbackSession();
    pushSessionToSW(session?.baseUrl, session?.accessToken);
  };

  navigator.serviceWorker.register(swUrl).then(sendSessionToSW);
  navigator.serviceWorker.ready.then(sendSessionToSW);

  navigator.serviceWorker.addEventListener('message', (ev) => {
    const { type } = ev.data ?? {};

    if (type === 'requestSession') {
      sendSessionToSW();
    }
  });
}

// A deploy replaces old chunks, so a tab still on the old build reloads to get the new one.
// Once per 10s at most, so a chunk that's really missing can't cause a reload loop.
window.addEventListener('vite:preloadError', (evt) => {
  const KEY = 'angaara.chunkReload';
  try {
    if (Date.now() - Number(sessionStorage.getItem(KEY) ?? 0) < 10000) return;
    sessionStorage.setItem(KEY, String(Date.now()));
  } catch {
    return;
  }
  evt.preventDefault();
  window.location.reload();
});

installPageShiftGuard();
installBackClosesPanels();

const mountApp = () => {
  const rootContainer = document.getElementById('root');

  if (rootContainer === null) {
    console.error('Root container element not found!');
    return;
  }

  const root = createRoot(rootContainer);
  root.render(<App />);
};

mountApp();

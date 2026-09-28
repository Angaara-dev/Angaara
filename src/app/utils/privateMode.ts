import { getSettings } from '../state/settings';

// With private mode on, nothing reaches Angaara's Worker (/api/*); only the homeserver is used.
let blocked = false;
export const isPrivateMode = () => blocked;
export const setPrivateMode = (on: boolean) => {
  blocked = on;
};

export const PRIVATE_MODE_MESSAGE =
  "Private mode is on, so this can't reach Angaara's servers. Turn it off in Settings → Account.";

const isWorkerUrl = (input: RequestInfo | URL): boolean => {
  let url: URL;
  try {
    url = new URL(input instanceof Request ? input.url : String(input), window.location.href);
  } catch {
    return false;
  }
  const ours = url.origin === window.location.origin || url.hostname.endsWith('angaara.app');
  return ours && url.pathname.startsWith('/api/');
};

// One guard for every fetch and popup, so no feature can slip past the switch.
export const installPrivateModeGuard = () => {
  try {
    blocked = getSettings().privateMode;
  } catch {
    // Unreadable settings: stay with the default.
  }
  const { fetch } = window;
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) =>
    blocked && isWorkerUrl(input)
      ? Promise.reject(new Error(PRIVATE_MODE_MESSAGE))
      : fetch(input, init);
  const { open } = window;
  window.open = (url?: string | URL, ...rest) =>
    blocked && url !== undefined && isWorkerUrl(url) ? null : open.call(window, url, ...rest);
};

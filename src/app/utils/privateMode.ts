import { MatrixClient } from 'matrix-js-sdk';
import { startAuthentication } from '@simplewebauthn/browser';
import type { PublicKeyCredentialRequestOptionsJSON } from '@simplewebauthn/browser';
import { getSettings } from '../state/settings';

// With private mode on, nothing reaches Angaara's Worker (/api/*); only the homeserver is used.
let blocked = false;
export const isPrivateMode = () => blocked;
export const setPrivateMode = (on: boolean) => {
  blocked = on;
};

const DELETE_PATH = '/api/account/delete';

const post = async (mx: MatrixClient, path: string, extra: Record<string, unknown> = {}) => {
  const res = await fetch(`${window.location.origin}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ openid: await mx.getOpenIdToken(), ...extra }),
  });
  const data = await res.json().catch(() => undefined);
  if (!res.ok) throw new Error(data?.error ?? "Couldn't delete your data. Try again later.");
  return data;
};

export type DeleteCheck = {
  // What to type: the Angaara username, or the Matrix username without one.
  username: string;
  // A passkey challenge, only when there's an Angaara account.
  options: PublicKeyCredentialRequestOptionsJSON | null;
};
export const getDeleteCheck = (mx: MatrixClient): Promise<DeleteCheck> =>
  post(mx, `${DELETE_PATH}/options`);

// Wipes everything Angaara's servers keep about you, after the passkey if one is needed.
export const deleteServerData = async (
  mx: MatrixClient,
  confirm: string,
  check: DeleteCheck
): Promise<void> => {
  const passkey = check.options
    ? await startAuthentication({ optionsJSON: check.options })
    : undefined;
  await post(mx, DELETE_PATH, { confirm, passkey });
};

export const PRIVATE_MODE_MESSAGE =
  "Private mode is on, so this can't reach Angaara's servers. Turn it off in Settings, under Account.";

const isWorkerUrl = (input: RequestInfo | URL): boolean => {
  let url: URL;
  try {
    url = new URL(input instanceof Request ? input.url : String(input), window.location.href);
  } catch {
    return false;
  }
  const ours = url.origin === window.location.origin || url.hostname.endsWith('angaara.app');
  // Deleting your data is always allowed, even with private mode on.
  return ours && url.pathname.startsWith('/api/') && !url.pathname.startsWith(DELETE_PATH);
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

import { MatrixClient } from 'matrix-js-sdk';
import { startAuthentication, startRegistration } from '@simplewebauthn/browser';

export type AngaaraAccount = {
  username: string;
  supporter: boolean;
  created: number;
  // Only ever shown to the account's owner.
  linked: string[];
  passkeys: number;
  maxLinks: number;
};

// Every step proves which Matrix account is asking, with a short-lived OpenID token.
const api = async (mx: MatrixClient, step: string, extra: Record<string, unknown> = {}) => {
  const res = await fetch(`${window.location.origin}/api/id/${step}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ openid: await mx.getOpenIdToken(), ...extra }),
  });
  const data = await res.json().catch(() => undefined);
  if (!res.ok) throw new Error(data?.error ?? 'Something went wrong. Try again.');
  return data;
};

export const getAngaaraAccount = async (mx: MatrixClient): Promise<AngaaraAccount | null> =>
  (await api(mx, 'me')).account;

export const registerPasskey = async (
  mx: MatrixClient,
  username?: string
): Promise<AngaaraAccount> => {
  const { options } = await api(mx, 'register/options', { username });
  const response = await startRegistration({ optionsJSON: options }).catch((e) => {
    if (e?.name === 'InvalidStateError') {
      throw new Error(
        'This device already has a passkey for your account. Use another device or a security key.'
      );
    }
    throw e;
  });
  return (await api(mx, 'register/verify', { response })).account;
};

export const signInWithPasskey = async (mx: MatrixClient): Promise<AngaaraAccount> => {
  const { options } = await api(mx, 'login/options');
  const response = await startAuthentication({ optionsJSON: options });
  return (await api(mx, 'login/verify', { response })).account;
};

export const unlinkAngaaraAccount = (mx: MatrixClient) => api(mx, 'unlink');

// The supporters site only opens from here: a one-use ticket is posted to it in a new tab.
export const openSupporterPage = async (mx: MatrixClient, siteUrl: string) => {
  const name = 'angaara-supporters';
  // Opened before the request, so popup blockers still count it as the click's own tab.
  const tab = window.open('about:blank', name);
  try {
    const { ticket } = await api(mx, 'handoff');
    const form = document.createElement('form');
    form.method = 'POST';
    form.action = `${siteUrl}/enter`;
    form.target = name;
    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = 'ticket';
    input.value = ticket;
    form.append(input);
    document.body.append(form);
    form.submit();
    form.remove();
  } catch (e) {
    tab?.close();
    throw e;
  }
};

// Browsers throw these when someone closes the passkey prompt; that's not worth an error.
export const cancelled = (e: unknown) =>
  e instanceof Error && (e.name === 'NotAllowedError' || e.name === 'AbortError');

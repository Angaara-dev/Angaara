// Marks an account as just registered here, so first-run screens only show for new accounts.
const KEY = 'angaara_new_account';

export const markNewAccount = (userId: string) => {
  try {
    localStorage.setItem(KEY, userId);
  } catch {
    // Storage blocked; the welcome panel just won't show.
  }
};

export const isNewAccount = (userId: string): boolean => {
  try {
    return localStorage.getItem(KEY) === userId;
  } catch {
    return false;
  }
};

export const clearNewAccount = () => {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Nothing to clear.
  }
};

// Single sign-on finishes on another site and comes back as a login. Starting from Register means
// a sign-up; starting from Login might be one too, if the account turns out to be brand new.
const SSO_KEY = 'angaara_signup_started';
const SSO_MAX_AGE_MS = 60 * 60 * 1000;
export type SsoStart = 'register' | 'login';

export const markSsoStarted = (kind: SsoStart) => {
  try {
    localStorage.setItem(SSO_KEY, `${kind}:${Date.now()}`);
  } catch {
    // Storage blocked; the welcome panel just won't show.
  }
};

export const takeSsoStarted = (): SsoStart | undefined => {
  try {
    const [kind, at] = (localStorage.getItem(SSO_KEY) ?? '').split(':');
    localStorage.removeItem(SSO_KEY);
    if (Date.now() - Number(at) >= SSO_MAX_AGE_MS) return undefined;
    return kind === 'register' || kind === 'login' ? kind : undefined;
  } catch {
    return undefined;
  }
};

const MAYBE_KEY = 'angaara_maybe_new_account';

export const markMaybeNewAccount = (userId: string) => {
  try {
    localStorage.setItem(MAYBE_KEY, userId);
  } catch {
    // Storage blocked.
  }
};

// Read once: the welcome panel decides on the first open after the login.
export const takeMaybeNewAccount = (userId: string): boolean => {
  try {
    const maybe = localStorage.getItem(MAYBE_KEY) === userId;
    localStorage.removeItem(MAYBE_KEY);
    return maybe;
  } catch {
    return false;
  }
};

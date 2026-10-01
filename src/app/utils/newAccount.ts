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

// Sign-ups through single sign-on (e.g. matrix.org) finish on another site and come back as a
// login, so the app remembers it sent you there to register.
const SIGNUP_KEY = 'angaara_signup_started';
const SIGNUP_MAX_AGE_MS = 60 * 60 * 1000;

export const markSignupStarted = () => {
  try {
    localStorage.setItem(SIGNUP_KEY, String(Date.now()));
  } catch {
    // Storage blocked; the welcome panel falls back to its empty-account check.
  }
};

export const takeSignupStarted = (): boolean => {
  try {
    const at = Number(localStorage.getItem(SIGNUP_KEY));
    localStorage.removeItem(SIGNUP_KEY);
    return Date.now() - at < SIGNUP_MAX_AGE_MS;
  } catch {
    return false;
  }
};

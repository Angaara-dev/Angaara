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

import { atom } from 'jotai';

// Kept light (atoms only) so the sidebar can read it without loading the GitHub page.
// `personal` marks a pasted token; missing means it came from the OAuth sign-in.
export type GitHubAccount = {
  token: string;
  login: string;
  avatarUrl?: string;
  personal?: boolean;
};
export type LinkedRepo = { owner: string; repo: string };

const ACCOUNT_KEY = 'angaara.github';
const REPOS_KEY = 'angaara.githubRepos';

const load = <T>(key: string, valid: (v: unknown) => boolean, fallback: T): T => {
  try {
    const value = JSON.parse(localStorage.getItem(key) ?? 'null');
    return valid(value) ? (value as T) : fallback;
  } catch {
    return fallback;
  }
};
const store = (key: string, value: unknown) => {
  try {
    if (value === undefined) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage blocked: the link just isn't remembered after a reload.
  }
};

const persisted = <T>(key: string, initial: T) => {
  const base = atom<T>(initial);
  return atom(
    (get) => get(base),
    (get, set, update: T | ((prev: T) => T)) => {
      const next = typeof update === 'function' ? (update as (prev: T) => T)(get(base)) : update;
      set(base, next);
      store(key, next);
    }
  );
};

const isAccount = (v: unknown) =>
  !!v &&
  typeof (v as GitHubAccount).token === 'string' &&
  typeof (v as GitHubAccount).login === 'string';
const isRepoList = (v: unknown) =>
  Array.isArray(v) && v.every((r) => typeof r?.owner === 'string' && typeof r?.repo === 'string');

export const githubAccountAtom = persisted<GitHubAccount | undefined>(
  ACCOUNT_KEY,
  load<GitHubAccount | undefined>(ACCOUNT_KEY, isAccount, undefined)
);
// The token GitHub last rejected; the link is stale while it matches the account's token.
export const githubExpiredTokenAtom = atom<string | undefined>(undefined);

export const linkedReposAtom = persisted<LinkedRepo[]>(
  REPOS_KEY,
  load<LinkedRepo[]>(REPOS_KEY, isRepoList, [])
);

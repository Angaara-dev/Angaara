import { ZipFile } from '../../../utils/zip';

const API = 'https://api.github.com';

export class GitHubError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

// Fired with the token when GitHub rejects it (expired or revoked), so the UI can offer a relink.
export const GITHUB_AUTH_FAILED = 'angaara-github-auth-failed';

// Every call goes straight from the browser to api.github.com with the user's token.
export const gh = async <T>(token: string, path: string, init?: RequestInit): Promise<T> => {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...init?.headers,
    },
  });
  if (!res.ok) {
    if (res.status === 401) {
      window.dispatchEvent(new CustomEvent(GITHUB_AUTH_FAILED, { detail: token }));
    }
    const body = await res.json().catch(() => ({}));
    const detail = Array.isArray(body.errors) ? body.errors[0]?.message : undefined;
    throw new GitHubError(detail ?? body.message ?? `GitHub error ${res.status}`, res.status);
  }
  return res.status === 204 ? (undefined as T) : res.json();
};

const seg = encodeURIComponent;
const repoPath = (owner: string, repo: string) => `/repos/${seg(owner)}/${seg(repo)}`;

export type GitHubUser = { login: string; avatar_url: string };
export type GitHubRepo = {
  name: string;
  full_name: string;
  owner: { login: string };
  private: boolean;
  default_branch: string;
  html_url: string;
  permissions?: { push?: boolean };
};
export type GitHubBranch = { name: string; commit: { sha: string } };
export type GitHubPull = {
  number: number;
  title: string;
  html_url: string;
  draft: boolean;
  head: { ref: string };
  base: { ref: string };
  user: { login: string };
};

export const getUser = (token: string) => gh<GitHubUser>(token, '/user');

export const listRepos = (token: string) =>
  gh<GitHubRepo[]>(
    token,
    '/user/repos?per_page=100&sort=pushed&affiliation=owner,collaborator,organization_member'
  );

export const getRepo = (token: string, owner: string, repo: string) =>
  gh<GitHubRepo>(token, repoPath(owner, repo));

export const listBranches = (token: string, owner: string, repo: string) =>
  gh<GitHubBranch[]>(token, `${repoPath(owner, repo)}/branches?per_page=100`);

export const listPulls = (token: string, owner: string, repo: string) =>
  gh<GitHubPull[]>(token, `${repoPath(owner, repo)}/pulls?state=open&per_page=30`);

// Project folder names become runner folders, so keep them to lowercase letters, digits and dashes.
export const projectRootFor = (repo: string) =>
  repo
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^[^a-z0-9]+/, '')
    .slice(0, 64) || 'repo';

const SKIP_DIRS = ['.git/', 'target/', 'node_modules/', 'dist/', 'bot-data/'];
const MAX_FILES = 500;
const MAX_FILE_BYTES = 1024 * 1024;

type TreeEntry = { path: string; mode: string; type: string; sha: string; size?: number };
export type BranchSnapshot = {
  files: ZipFile[];
  headSha: string;
  // Git file modes by relative path, so commits keep executables executable.
  modes: Record<string, string>;
  skipped: number;
};

const decodeBase64 = (b64: string) =>
  Uint8Array.from(atob(b64.replace(/\n/g, '')), (c) => c.charCodeAt(0));

export const fetchBranch = async (
  token: string,
  owner: string,
  repo: string,
  branch: string,
  root: string
): Promise<BranchSnapshot> => {
  const base = repoPath(owner, repo);
  const head = await gh<{ object: { sha: string } }>(
    token,
    `${base}/git/ref/heads/${branch.split('/').map(seg).join('/')}`
  );
  const headSha = head.object.sha;
  const tree = await gh<{ tree: TreeEntry[]; truncated: boolean }>(
    token,
    `${base}/git/trees/${headSha}?recursive=1`
  );
  const blobs = tree.tree.filter((e) => e.type === 'blob' && e.mode !== '120000');
  const wanted = blobs.filter(
    (e) => !SKIP_DIRS.some((d) => e.path.startsWith(d)) && (e.size ?? 0) <= MAX_FILE_BYTES
  );
  if (wanted.length > MAX_FILES) {
    throw new Error(
      `This branch has ${wanted.length} files; the editor handles up to ${MAX_FILES}.`
    );
  }

  const decoder = new TextDecoder('utf-8', { fatal: true });
  const files: ZipFile[] = [];
  const modes: Record<string, string> = {};
  let skipped = blobs.length - wanted.length;
  let next = 0;
  // A few downloads at a time keeps well inside GitHub's rate limits.
  const worker = async () => {
    while (next < wanted.length) {
      const entry = wanted[next];
      next += 1;
      // eslint-disable-next-line no-await-in-loop
      const blob = await gh<{ content: string }>(token, `${base}/git/blobs/${entry.sha}`);
      try {
        files.push({
          path: `${root}/${entry.path}`,
          content: decoder.decode(decodeBase64(blob.content)),
        });
        modes[entry.path] = entry.mode;
      } catch {
        skipped += 1;
      }
    }
  };
  await Promise.all(Array.from({ length: 6 }, worker));
  files.sort((a, b) => a.path.localeCompare(b.path));
  return { files, headSha, modes, skipped: skipped + (tree.truncated ? 1 : 0) };
};

export type CommitChange = { path: string; content?: string };
type CommitOptions = {
  owner: string;
  repo: string;
  branch: string;
  // The commit the changes were compared against; the push fails if the branch moved since.
  baseSha: string;
  // Create this branch from baseSha and commit there instead.
  newBranch?: string;
  message: string;
  // Files to write (content set) or delete (content undefined), relative to the repo root.
  changes: CommitChange[];
  modes: Record<string, string>;
};

// One commit through GitHub's Git Data API: blobs, a tree on top of the old one, the commit, the ref.
export const commitChanges = async (token: string, opts: CommitOptions) => {
  const base = repoPath(opts.owner, opts.repo);
  const target = opts.newBranch ?? opts.branch;
  if (opts.newBranch) {
    await gh(token, `${base}/git/refs`, {
      method: 'POST',
      body: JSON.stringify({ ref: `refs/heads/${opts.newBranch}`, sha: opts.baseSha }),
    });
  }
  const parent = await gh<{ tree: { sha: string } }>(token, `${base}/git/commits/${opts.baseSha}`);
  const entries = await Promise.all(
    opts.changes.map(async (change) => {
      const mode = opts.modes[change.path] ?? '100644';
      if (change.content === undefined) {
        return { path: change.path, mode, type: 'blob', sha: null };
      }
      const blob = await gh<{ sha: string }>(token, `${base}/git/blobs`, {
        method: 'POST',
        body: JSON.stringify({ content: change.content, encoding: 'utf-8' }),
      });
      return { path: change.path, mode, type: 'blob', sha: blob.sha };
    })
  );
  const tree = await gh<{ sha: string }>(token, `${base}/git/trees`, {
    method: 'POST',
    body: JSON.stringify({ base_tree: parent.tree.sha, tree: entries }),
  });
  const commit = await gh<{ sha: string; html_url: string }>(token, `${base}/git/commits`, {
    method: 'POST',
    body: JSON.stringify({ message: opts.message, tree: tree.sha, parents: [opts.baseSha] }),
  });
  try {
    await gh(token, `${base}/git/refs/heads/${target.split('/').map(seg).join('/')}`, {
      method: 'PATCH',
      body: JSON.stringify({ sha: commit.sha, force: false }),
    });
  } catch (e) {
    if (e instanceof GitHubError && e.status === 422) {
      throw new Error(`${target} has new commits on GitHub. Compare again, then commit.`);
    }
    throw e;
  }
  return { sha: commit.sha, parent: opts.baseSha, url: commit.html_url, branch: target };
};

// Moves the branch back to the parent, but only while our commit is still its tip.
export const uncommit = async (
  token: string,
  opts: { owner: string; repo: string; branch: string; sha: string; parent: string }
) => {
  const ref = `${repoPath(opts.owner, opts.repo)}/git/refs/heads/${opts.branch
    .split('/')
    .map(seg)
    .join('/')}`;
  const head = await gh<{ object: { sha: string } }>(token, ref);
  if (head.object.sha !== opts.sha) {
    throw new Error(`${opts.branch} has newer commits, so this one can't be undone safely.`);
  }
  await gh(token, ref, {
    method: 'PATCH',
    body: JSON.stringify({ sha: opts.parent, force: true }),
  });
};

// Empty repos reject the Git Data API, so the first commit goes through the contents API.
export const initRepo = (token: string, owner: string, repo: string) => {
  const bytes = new TextEncoder().encode(`# ${repo}\n`);
  return gh(token, `${repoPath(owner, repo)}/contents/README.md`, {
    method: 'PUT',
    body: JSON.stringify({
      message: 'Initial commit',
      content: btoa(String.fromCharCode(...bytes)),
    }),
  });
};

export const createDraftPull = (
  token: string,
  owner: string,
  repo: string,
  pull: { head: string; base: string; title: string; body: string }
) =>
  gh<GitHubPull>(token, `${repoPath(owner, repo)}/pulls`, {
    method: 'POST',
    body: JSON.stringify({ ...pull, draft: true }),
  });

export const createBranch = (
  token: string,
  owner: string,
  repo: string,
  name: string,
  sha: string
) =>
  gh(token, `${repoPath(owner, repo)}/git/refs`, {
    method: 'POST',
    body: JSON.stringify({ ref: `refs/heads/${name}`, sha }),
  });

// Opens GitHub's sign-in in a popup; the worker posts the token back to this tab only.
export const signInWithGitHub = (): Promise<string> =>
  new Promise((resolve, reject) => {
    const popup = window.open('/api/github/login', 'angaara-github', 'width=600,height=720');
    if (!popup) {
      reject(new Error('Allow popups for this site to sign in with GitHub.'));
      return;
    }
    let closedTimer = 0;
    function onMessage(evt: MessageEvent) {
      if (evt.origin !== window.location.origin || evt.source !== popup) return;
      if (evt.data?.type !== 'angaara-github-auth') return;
      window.removeEventListener('message', onMessage);
      window.clearInterval(closedTimer);
      if (typeof evt.data.token === 'string') resolve(evt.data.token);
      else reject(new Error(evt.data.error ?? 'GitHub sign-in failed.'));
    }
    closedTimer = window.setInterval(() => {
      if (!popup.closed) return;
      window.removeEventListener('message', onMessage);
      window.clearInterval(closedTimer);
      reject(new Error('Sign-in window was closed.'));
    }, 500);
    window.addEventListener('message', onMessage);
  });

// Revokes the grant on GitHub (through the worker, which holds the app secret).
export const revokeGitHub = async (token: string) => {
  await fetch('/api/github/revoke', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
  }).catch(() => undefined);
};

export const githubSignInAvailable = async (): Promise<boolean> => {
  try {
    const res = await fetch('/api/github/status');
    return res.ok && (await res.json()).configured === true;
  } catch {
    return false;
  }
};

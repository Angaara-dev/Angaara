import React, { ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { atom, useAtom, useAtomValue } from 'jotai';
import { useNavigate } from 'react-router-dom';
import { siGithub } from 'simple-icons';
import { Box, Button, Chip, color, config, Icon, Icons, Input, Spinner, Text, toRem } from 'folds';
import { getHomeDeveloperPath } from '../../../pages/pathUtils';
import { Workspace, workspaceAtom } from '../workspace';
import { DiffReview } from '../DiffReview';
import { Change, diffFiles, takeRemote } from '../diff';
import { githubAccountAtom, githubExpiredTokenAtom, linkedReposAtom, LinkedRepo } from './state';
import {
  BranchSnapshot,
  commitChanges,
  createBranch,
  createDraftPull,
  fetchBranch,
  getRepo,
  GITHUB_AUTH_FAILED,
  GitHubError,
  getUser,
  initRepo,
  GitHubBranch,
  GitHubPull,
  GitHubRepo,
  githubSignInAvailable,
  listBranches,
  listPulls,
  listRepos,
  projectRootFor,
  revokeGitHub,
  signInWithGitHub,
  uncommit,
} from './api';

export function GitHubLogo({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d={siGithub.path} />
    </svg>
  );
}

const EXPIRED_TEXT = 'GitHub sign-in expired or was revoked. Relink GitHub to reconnect.';
const errorText = (e: unknown, fallback: string) => {
  if (e instanceof GitHubError && e.status === 401) return EXPIRED_TEXT;
  return e instanceof Error ? e.message : fallback;
};
// Git branch names: no spaces, no "..", no leading dash or trailing slash or ".lock".
const validBranchName = (name: string) =>
  /^[\w./-]+$/.test(name) &&
  !name.startsWith('-') &&
  !name.startsWith('/') &&
  !name.endsWith('/') &&
  !name.endsWith('.lock') &&
  !name.includes('..') &&
  !name.includes('//');

// Files that usually hold credentials; they start unticked in the commit list.
const SECRET_FILE =
  /(^|\/)(\.env(\.(?!example$|sample$|template$)[\w.-]+)?|[^/]+\.(pem|key|p12|pfx)|id_(rsa|ed25519|ecdsa)[^/]*)$/i;
const isSecretFile = (path: string) => SECRET_FILE.test(path);

// The last fetched copy of each branch, shared by Build Tools and Linked Developer Repos.
const snapshotsAtom = atom<Record<string, BranchSnapshot>>({});
const snapshotKey = (w: { owner: string; repo: string; branch: string }) =>
  `${w.owner}/${w.repo}#${w.branch}`;

function Panel({ children, tone, id }: { children: ReactNode; tone?: string; id?: string }) {
  return (
    <Box
      id={id}
      direction="Column"
      gap="300"
      style={{
        padding: config.space.S300,
        borderRadius: config.radii.R400,
        background: color.Background.Container,
        color: color.Background.OnContainer,
        border: `1px solid ${tone ?? color.Background.ContainerLine}`,
      }}
    >
      {children}
    </Box>
  );
}

function ErrorLine({ text }: { text?: string }) {
  if (!text) return null;
  return (
    <Text size="T200" style={{ color: color.Critical.Main }}>
      {text}
    </Text>
  );
}

const selectStyle = {
  padding: config.space.S100,
  borderRadius: config.radii.R300,
  background: color.Secondary.Container,
  color: color.Secondary.OnContainer,
  border: `1px solid ${color.Secondary.ContainerLine}`,
};

export function useGitHub() {
  const [account, setAccount] = useAtom(githubAccountAtom);
  const [, setRepos] = useAtom(linkedReposAtom);
  const link = useCallback(async () => {
    const token = await signInWithGitHub();
    const user = await getUser(token);
    setAccount({ token, login: user.login, avatarUrl: user.avatar_url });
  }, [setAccount]);
  // Talks to GitHub directly, so a personal token never passes through this server.
  const linkToken = useCallback(
    async (raw: string) => {
      const token = raw.trim();
      if (!/^[\w-]{20,255}$/.test(token)) throw new Error("That doesn't look like a GitHub token.");
      const user = await getUser(token).catch(() => {
        throw new Error('GitHub rejected that token. Check it has not expired.');
      });
      setAccount({ token, login: user.login, avatarUrl: user.avatar_url, personal: true });
    },
    [setAccount]
  );
  const unlink = useCallback(async () => {
    // Only app tokens can be revoked by the app; personal ones are deleted on GitHub.
    if (account && !account.personal) await revokeGitHub(account.token);
    setAccount(undefined);
    setRepos([]);
  }, [account, setAccount, setRepos]);
  return { account, link, linkToken, unlink };
}

// Tokens already checked this session, so each is only verified once.
const checkedTokens = new Set<string>();

// True while GitHub rejects the linked token; any 401 from the API flags it.
function useGitHubExpired(): boolean {
  const account = useAtomValue(githubAccountAtom);
  const [expiredToken, setExpiredToken] = useAtom(githubExpiredTokenAtom);
  useEffect(() => {
    const onFail = (evt: Event) => setExpiredToken((evt as CustomEvent<string>).detail);
    window.addEventListener(GITHUB_AUTH_FAILED, onFail);
    return () => window.removeEventListener(GITHUB_AUTH_FAILED, onFail);
  }, [setExpiredToken]);
  useEffect(() => {
    if (!account || checkedTokens.has(account.token)) return;
    checkedTokens.add(account.token);
    getUser(account.token).catch(() => undefined);
  }, [account]);
  return !!account && expiredToken === account.token;
}

const NEW_TOKEN_URL = 'https://github.com/settings/personal-access-tokens/new';
const NEW_CLASSIC_TOKEN_URL =
  'https://github.com/settings/tokens/new?scopes=repo&description=Angaara';

function PersonalTokenForm({ onDone }: { onDone?: () => void }) {
  const { linkToken } = useGitHub();
  const [token, setToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  const submit = async () => {
    setBusy(true);
    setError(undefined);
    try {
      await linkToken(token);
      onDone?.();
    } catch (e) {
      setError(errorText(e, 'Could not link that token.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Box
      direction="Column"
      gap="200"
      style={{
        borderTop: `1px solid ${color.Background.ContainerLine}`,
        paddingTop: config.space.S300,
      }}
    >
      <Text size="L400">Use a personal access token</Text>
      <Text size="T200" priority="300">
        Skips the sign-in app. Needs <b>Contents</b> and <b>Pull requests</b> read and write
        (fine-grained) or the <b>repo</b> scope (classic). It stays in this browser only; delete it
        on GitHub when you&apos;re done.
      </Text>
      <Box gap="200" wrap="Wrap">
        <Chip
          as="a"
          href={NEW_TOKEN_URL}
          target="_blank"
          rel="noreferrer noopener"
          variant="SurfaceVariant"
          radii="Pill"
        >
          <Text size="B300">Create Fine-Grained Token</Text>
        </Chip>
        <Chip
          as="a"
          href={NEW_CLASSIC_TOKEN_URL}
          target="_blank"
          rel="noreferrer noopener"
          variant="SurfaceVariant"
          radii="Pill"
        >
          <Text size="B300">Create Classic Token</Text>
        </Chip>
      </Box>
      <form
        style={{ display: 'flex', gap: config.space.S200, alignItems: 'center' }}
        onSubmit={(e) => {
          e.preventDefault();
          if (!busy && token) submit();
        }}
      >
        <Box grow="Yes">
          <Input
            type="password"
            autoComplete="off"
            spellCheck={false}
            aria-label="GitHub personal access token"
            placeholder="github_pat_... or ghp_..."
            value={token}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setToken(e.target.value)}
            variant="Background"
            size="300"
            radii="300"
          />
        </Box>
        <Button
          type="submit"
          size="300"
          variant="Primary"
          fill="Solid"
          radii="300"
          disabled={busy || !token}
          before={busy ? <Spinner size="100" variant="Primary" fill="Solid" /> : undefined}
        >
          <Text size="B300">Link Token</Text>
        </Button>
      </form>
      <ErrorLine text={error} />
    </Box>
  );
}

function LinkGitHubButton({
  label = 'Link GitHub',
  onDone,
}: {
  label?: string;
  onDone?: () => void;
}) {
  const { link } = useGitHub();
  const [available, setAvailable] = useState<boolean>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [showToken, setShowToken] = useState(false);
  useEffect(() => {
    githubSignInAvailable().then(setAvailable);
  }, []);

  return (
    <Box direction="Column" gap="100">
      <Box gap="200" alignItems="Center" wrap="Wrap">
        <Button
          size="300"
          variant="Secondary"
          fill="Solid"
          radii="300"
          disabled={busy || available === false}
          before={busy ? <Spinner size="100" variant="Secondary" /> : <GitHubLogo />}
          onClick={async () => {
            setBusy(true);
            setError(undefined);
            try {
              await link();
              onDone?.();
            } catch (e) {
              setError(errorText(e, 'GitHub sign-in failed.'));
            } finally {
              setBusy(false);
            }
          }}
        >
          <Text size="B300">{label}</Text>
        </Button>
        {available === false && (
          <Text size="T200" priority="300">
            GitHub sign-in isn&apos;t available right now.
          </Text>
        )}
        <Chip
          variant={showToken ? 'Primary' : 'SurfaceVariant'}
          radii="Pill"
          aria-pressed={showToken}
          onClick={() => setShowToken((v) => !v)}
        >
          <Text size="B300">Use a Token Instead</Text>
        </Chip>
      </Box>
      <ErrorLine text={error} />
      {showToken && <PersonalTokenForm onDone={onDone} />}
    </Box>
  );
}

function RepoPicker({ onPick }: { onPick: (repo: GitHubRepo) => void }) {
  const account = useAtomValue(githubAccountAtom);
  const [repos, setRepos] = useState<GitHubRepo[]>();
  const [error, setError] = useState<string>();
  const [query, setQuery] = useState('');
  useEffect(() => {
    if (!account) return;
    listRepos(account.token)
      .then(setRepos)
      .catch((e) => setError(errorText(e, "Couldn't load your repos.")));
  }, [account]);

  const shown = useMemo(
    () =>
      (repos ?? [])
        .filter((r) => r.full_name.toLowerCase().includes(query.trim().toLowerCase()))
        .slice(0, 30),
    [repos, query]
  );

  return (
    <Box direction="Column" gap="200">
      <Input
        value={query}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setQuery(e.target.value)}
        size="300"
        variant="Secondary"
        radii="300"
        placeholder="Search your repos"
        before={<Icon size="100" src={Icons.Search} />}
      />
      <ErrorLine text={error} />
      {!repos && !error && <Spinner size="200" variant="Secondary" />}
      <Box direction="Column" gap="100" style={{ maxHeight: toRem(260), overflowY: 'auto' }}>
        {shown.map((r) => (
          <Box
            key={r.full_name}
            as="button"
            type="button"
            onClick={() => onPick(r)}
            alignItems="Center"
            gap="200"
            style={{
              padding: config.space.S200,
              borderRadius: config.radii.R300,
              border: 'none',
              background: 'transparent',
              color: 'inherit',
              cursor: 'pointer',
              textAlign: 'left',
            }}
          >
            <GitHubLogo size={14} />
            <Text size="T300" truncate>
              {r.full_name}
            </Text>
            {r.private && (
              <Text size="L400" priority="300">
                private
              </Text>
            )}
          </Box>
        ))}
        {repos && shown.length === 0 && (
          <Text size="T200" priority="300">
            No repos match.
          </Text>
        )}
      </Box>
    </Box>
  );
}

// Signs in again and swaps in the new token; linked repos and projects stay as they are.
function RelinkBox({ expired, onDone }: { expired: boolean; onDone: () => void }) {
  return (
    <Box
      direction="Column"
      gap="200"
      style={{
        padding: config.space.S300,
        borderRadius: config.radii.R300,
        border: `1px solid ${expired ? color.Warning.Main : color.Background.ContainerLine}`,
      }}
    >
      <Box gap="200" alignItems="Center">
        {expired && <Icon size="100" src={Icons.Warning} style={{ color: color.Warning.Main }} />}
        <Text size="T300">
          {expired
            ? 'Your GitHub connection expired or was revoked.'
            : 'Reconnect GitHub, or switch to another account or token.'}
        </Text>
      </Box>
      <Text size="T200" priority="300">
        Your linked repos and projects stay put, they just start working again once you relink.
      </Text>
      <LinkGitHubButton label="Relink GitHub" onDone={onDone} />
    </Box>
  );
}

function RelinkChip({ open, onClick }: { open: boolean; onClick: () => void }) {
  return (
    <Chip
      variant={open ? 'Primary' : 'SurfaceVariant'}
      radii="Pill"
      aria-pressed={open}
      onClick={onClick}
      before={<Icon size="50" src={Icons.Reload} />}
    >
      <Text size="B300">Relink</Text>
    </Chip>
  );
}

// Top of Build Tools: link the account, connect a repo, and jump to Linked Developer Repos.
export function GitHubLinkBar() {
  const { account } = useGitHub();
  const [linked, setLinked] = useAtom(linkedReposAtom);
  const workspace = useAtomValue(workspaceAtom);
  const navigate = useNavigate();
  const [picking, setPicking] = useState(false);
  const [relinking, setRelinking] = useState(false);
  const expired = useGitHubExpired();

  if (!account) {
    return (
      <Panel>
        <LinkGitHubButton />
      </Panel>
    );
  }

  const addRepo = (r: GitHubRepo) => {
    const repo: LinkedRepo = { owner: r.owner.login, repo: r.name };
    setLinked((list) =>
      list.some((l) => l.owner === repo.owner && l.repo === repo.repo) ? list : [...list, repo]
    );
    setPicking(false);
    navigate(getHomeDeveloperPath('repos'));
  };

  return (
    <Panel>
      <Box gap="200" alignItems="Center" wrap="Wrap">
        <GitHubLogo />
        <Text size="T300">
          Linked as <b>@{account.login}</b>
          {account.personal && ' (personal token)'}
        </Text>
        {workspace.github && (
          <Text size="T200" priority="300">
            Editing {workspace.github.owner}/{workspace.github.repo} on{' '}
            <code>{workspace.github.branch}</code>
          </Text>
        )}
        <Box grow="Yes" />
        {linked.length > 0 && (
          <Chip
            variant="SurfaceVariant"
            radii="Pill"
            onClick={() => navigate(getHomeDeveloperPath('repos'))}
          >
            <Text size="B300">Linked Developer Repos</Text>
          </Chip>
        )}
        <RelinkChip open={relinking || expired} onClick={() => setRelinking((v) => !v)} />
        <Chip
          variant={picking ? 'Primary' : 'SurfaceVariant'}
          radii="Pill"
          disabled={expired}
          onClick={() => setPicking((v) => !v)}
          before={<Icon size="50" src={Icons.Plus} />}
        >
          <Text size="B300">Connect a Repo</Text>
        </Chip>
      </Box>
      {(relinking || expired) && <RelinkBox expired={expired} onDone={() => setRelinking(false)} />}
      {picking && !expired && <RepoPicker onPick={addRepo} />}
    </Panel>
  );
}

// Fetches (and caches) the branch the workspace came from.
function useBranchSnapshot(target?: { owner: string; repo: string; branch: string; root: string }) {
  const account = useAtomValue(githubAccountAtom);
  const [snapshots, setSnapshots] = useAtom(snapshotsAtom);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const key = target && snapshotKey(target);
  const snapshot = key ? snapshots[key] : undefined;

  const refresh = useCallback(async () => {
    if (!account || !target || !key) return;
    setLoading(true);
    setError(undefined);
    try {
      const snap = await fetchBranch(
        account.token,
        target.owner,
        target.repo,
        target.branch,
        target.root
      );
      setSnapshots((all) => ({ ...all, [key]: snap }));
    } catch (e) {
      setError(errorText(e, "Couldn't fetch the branch."));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account, key, target?.root, setSnapshots]);

  return { snapshot, loading, error, refresh };
}

function DraftPullForm({ owner, repo, head }: { owner: string; repo: string; head: string }) {
  const account = useAtomValue(githubAccountAtom);
  const [open, setOpen] = useState(false);
  const [branches, setBranches] = useState<GitHubBranch[]>();
  const [base, setBase] = useState('');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [created, setCreated] = useState<GitHubPull>();

  useEffect(() => {
    if (!open || !account) return;
    Promise.all([listBranches(account.token, owner, repo), getRepo(account.token, owner, repo)])
      .then(([list, info]) => {
        setBranches(list);
        setBase((b) => b || (info.default_branch !== head ? info.default_branch : ''));
      })
      .catch((e) => setError(errorText(e, "Couldn't load branches.")));
  }, [open, account, owner, repo, head]);

  if (!account) return null;
  if (!open) {
    return (
      <Box>
        <Chip variant="SurfaceVariant" radii="Pill" onClick={() => setOpen(true)}>
          <Text size="B300">Draft a Pull Request</Text>
        </Chip>
      </Box>
    );
  }

  return (
    <Box
      direction="Column"
      gap="200"
      style={{
        borderTop: `1px solid ${color.Background.ContainerLine}`,
        paddingTop: config.space.S300,
      }}
    >
      <Box gap="200" alignItems="Center" wrap="Wrap">
        <Text size="L400">Draft Pull Request</Text>
        <Text size="T200" priority="300">
          <code>{head}</code> into
        </Text>
        <select
          value={base}
          onChange={(e) => setBase(e.target.value)}
          aria-label="Base branch"
          style={selectStyle}
        >
          <option value="">Pick a base branch</option>
          {branches
            ?.filter((b) => b.name !== head)
            .map((b) => (
              <option key={b.name} value={b.name}>
                {b.name}
              </option>
            ))}
        </select>
        <Box grow="Yes" />
        <Chip variant="SurfaceVariant" radii="Pill" onClick={() => setOpen(false)}>
          <Text size="B300">Cancel</Text>
        </Chip>
      </Box>
      <Input
        value={title}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTitle(e.target.value)}
        size="300"
        variant="Secondary"
        radii="300"
        placeholder="Title"
      />
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Describe the change (optional)"
        rows={4}
        style={{
          resize: 'vertical',
          padding: config.space.S200,
          borderRadius: config.radii.R300,
          background: color.Background.Container,
          color: color.Background.OnContainer,
          border: `1px solid ${color.Background.ContainerLine}`,
          fontFamily: 'inherit',
        }}
      />
      <Box gap="200" alignItems="Center">
        <Button
          size="300"
          variant="Secondary"
          fill="Solid"
          radii="300"
          disabled={busy || !base || !title.trim()}
          before={busy ? <Spinner size="100" variant="Secondary" /> : <GitHubLogo />}
          onClick={async () => {
            setBusy(true);
            setError(undefined);
            try {
              setCreated(
                await createDraftPull(account.token, owner, repo, {
                  head,
                  base,
                  title: title.trim(),
                  body,
                })
              );
            } catch (e) {
              setError(errorText(e, "Couldn't create the pull request."));
            } finally {
              setBusy(false);
            }
          }}
        >
          <Text size="B300">Create Draft PR</Text>
        </Button>
        {created && (
          <Text size="T200" style={{ color: color.Success.Main }}>
            Opened{' '}
            <a href={created.html_url} target="_blank" rel="noreferrer noopener">
              #{created.number}
            </a>
          </Text>
        )}
      </Box>
      <ErrorLine text={error} />
    </Box>
  );
}

const COMMIT_PANEL_ID = 'angaara-github-commit';

// Toolbar picks: which linked branch the project commits to, and a jump to the commit box.
export function GitHubEditorActions() {
  const account = useAtomValue(githubAccountAtom);
  const linked = useAtomValue(linkedReposAtom);
  const [workspace, setWorkspace] = useAtom(workspaceAtom);
  const [branches, setBranches] = useState<Record<string, string[]>>({});

  const loadBranches = useCallback(() => {
    if (!account) return;
    linked.forEach(({ owner, repo }) => {
      listBranches(account.token, owner, repo)
        .then((list) =>
          setBranches((all) => ({ ...all, [`${owner}/${repo}`]: list.map((b) => b.name) }))
        )
        .catch(() => undefined);
    });
  }, [account, linked]);
  useEffect(loadBranches, [loadBranches]);

  if (!account || linked.length === 0) return null;
  const gh = workspace.github;
  const value = gh ? `${gh.owner}/${gh.repo}#${gh.branch}` : '';

  return (
    <>
      <select
        value={value}
        onChange={(e) => {
          const [full, branch] = e.target.value.split('#');
          const [owner, repo] = full.split('/');
          if (owner && repo && branch) {
            setWorkspace((ws: Workspace) => ({ ...ws, github: { owner, repo, branch } }));
          }
        }}
        aria-label="GitHub branch"
        // Refetch on open so branches made on GitHub show up without a reload.
        onPointerDown={loadBranches}
        style={{ ...selectStyle, width: 'clamp(10rem, 30vw, 22rem)', maxWidth: '100%' }}
      >
        {!gh && <option value="">Select Branch</option>}
        {gh && !branches[`${gh.owner}/${gh.repo}`]?.includes(gh.branch) && (
          <option value={value}>{gh.branch}</option>
        )}
        {linked.map(({ owner, repo }) => (
          <optgroup key={`${owner}/${repo}`} label={`${owner}/${repo}`}>
            {branches[`${owner}/${repo}`]?.length === 0 && (
              <option disabled>No branches yet</option>
            )}
            {(branches[`${owner}/${repo}`] ?? []).map((b) => (
              <option key={b} value={`${owner}/${repo}#${b}`}>
                {b}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
      <Chip
        variant="SurfaceVariant"
        radii="Pill"
        disabled={!gh}
        onClick={() =>
          document.getElementById(COMMIT_PANEL_ID)?.scrollIntoView({ behavior: 'smooth' })
        }
        before={<GitHubLogo size={14} />}
      >
        <Text size="B300">Commit to GitHub</Text>
      </Chip>
    </>
  );
}

// Below the editor: review what changed against the branch, commit, and draft a PR.
export function GitHubCommitPanel() {
  const account = useAtomValue(githubAccountAtom);
  const [workspace, setWorkspace] = useAtom(workspaceAtom);
  const gh = workspace.github;
  const target = useMemo(() => gh && { ...gh, root: workspace.root }, [gh, workspace.root]);
  const { snapshot, loading, error, refresh } = useBranchSnapshot(target);
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState('');
  const [newBranch, setNewBranch] = useState('');
  const [toNewBranch, setToNewBranch] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [commitError, setCommitError] = useState<string>();
  const [result, setResult] = useState<{
    url: string;
    branch: string;
    sha: string;
    parent: string;
  }>();
  const [undoing, setUndoing] = useState(false);
  // Secret files are left out once; ticking one afterwards is the user's call.
  const seenSecrets = useRef(new Set<string>());
  const [reviewing, setReviewing] = useState(false);

  useEffect(() => {
    if (gh && !snapshot && !loading) refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gh?.owner, gh?.repo, gh?.branch]);

  const changes = useMemo(
    () => (snapshot ? diffFiles(workspace.files, snapshot.files, workspace.root) : []),
    [snapshot, workspace.files, workspace.root]
  );
  const picked = changes.filter((c) => !excluded.has(c.path));
  const pickedSecrets = picked.filter((c) => isSecretFile(c.path)).map((c) => c.path);

  useEffect(() => {
    const fresh = changes
      .map((c) => c.path)
      .filter((p) => isSecretFile(p) && !seenSecrets.current.has(p));
    if (fresh.length === 0) return;
    fresh.forEach((p) => seenSecrets.current.add(p));
    setExcluded((prev) => new Set([...prev, ...fresh]));
  }, [changes]);

  if (!account || !gh) return null;

  const commit = async () => {
    if (!snapshot || picked.length === 0 || !message.trim()) return;
    const branchName = newBranch.trim();
    if (toNewBranch && !validBranchName(branchName)) {
      setCommitError('That branch name has characters Git does not allow.');
      return;
    }
    setCommitting(true);
    setCommitError(undefined);
    setResult(undefined);
    try {
      const done = await commitChanges(account.token, {
        owner: gh.owner,
        repo: gh.repo,
        branch: gh.branch,
        baseSha: snapshot.headSha,
        newBranch: toNewBranch ? branchName : undefined,
        message: message.trim(),
        changes: picked.map((c) => ({ path: c.path, content: c.local })),
        modes: snapshot.modes,
      });
      setResult(done);
      setMessage('');
      setExcluded(new Set(seenSecrets.current));
      if (toNewBranch) {
        setWorkspace((ws: Workspace) => ({
          ...ws,
          github: ws.github && { ...ws.github, branch: done.branch },
        }));
        setToNewBranch(false);
        setNewBranch('');
      } else {
        refresh();
      }
    } catch (e) {
      setCommitError(errorText(e, 'Commit failed.'));
    } finally {
      setCommitting(false);
    }
  };

  const undoCommit = async () => {
    if (!result) return;
    setUndoing(true);
    setCommitError(undefined);
    try {
      await uncommit(account.token, { owner: gh.owner, repo: gh.repo, ...result });
      setResult(undefined);
      refresh();
    } catch (e) {
      setCommitError(errorText(e, "Couldn't undo the commit."));
    } finally {
      setUndoing(false);
    }
  };

  const onTakeRemote = (list: Change[]) => {
    if (snapshot)
      setWorkspace((ws: Workspace) => ({ ...ws, files: takeRemote(ws.files, list, ws.root) }));
  };

  return (
    <Panel id={COMMIT_PANEL_ID} tone={changes.length > 0 ? color.Primary.Main : undefined}>
      <Box gap="200" alignItems="Center" wrap="Wrap">
        <GitHubLogo />
        <Text size="H6">
          Commit to {gh.owner}/{gh.repo}
        </Text>
        <Text size="T200" priority="300">
          on <code>{gh.branch}</code>
        </Text>
        <Box grow="Yes" />
        {loading && <Spinner size="100" variant="Secondary" />}
        {changes.length > 0 && (
          <Chip
            variant={reviewing ? 'Primary' : 'SurfaceVariant'}
            radii="Pill"
            onClick={() => setReviewing((v) => !v)}
          >
            <Text size="B300">{reviewing ? 'Hide Diff' : 'Review Diff'}</Text>
          </Chip>
        )}
        <Chip
          variant="SurfaceVariant"
          radii="Pill"
          disabled={loading}
          onClick={refresh}
          before={<Icon size="50" src={Icons.Reload} />}
        >
          <Text size="B300">Fetch Branch</Text>
        </Chip>
      </Box>
      <ErrorLine text={error} />
      {snapshot && changes.length === 0 && (
        <Text size="T200" priority="300">
          No changes. The editor matches {gh.branch} on GitHub.
        </Text>
      )}
      {reviewing && changes.length > 0 && (
        <DiffReview changes={changes} remoteName={gh.branch} onTakeRemote={onTakeRemote} />
      )}
      {changes.length > 0 && (
        <Box direction="Column" gap="200">
          <Box direction="Column" gap="100" style={{ maxHeight: toRem(200), overflowY: 'auto' }}>
            {changes.map((c) => (
              <Box key={c.path} as="label" gap="200" alignItems="Center">
                <input
                  type="checkbox"
                  checked={!excluded.has(c.path)}
                  onChange={(e) =>
                    setExcluded((prev) => {
                      const next = new Set(prev);
                      if (e.target.checked) next.delete(c.path);
                      else next.add(c.path);
                      return next;
                    })
                  }
                />
                <Text
                  size="T200"
                  style={{
                    color: {
                      changed: color.Warning.Main,
                      local: color.Success.Main,
                      remote: color.Critical.Main,
                    }[c.kind],
                    flexShrink: 0,
                  }}
                >
                  {{ changed: 'M', local: 'A', remote: 'D' }[c.kind]}
                </Text>
                <Text size="T200" truncate>
                  {c.path}
                </Text>
              </Box>
            ))}
          </Box>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Commit message"
            rows={3}
            style={{
              resize: 'vertical',
              padding: config.space.S200,
              borderRadius: config.radii.R300,
              background: color.Background.Container,
              color: color.Background.OnContainer,
              border: `1px solid ${color.Background.ContainerLine}`,
              fontFamily: 'inherit',
            }}
          />
          {pickedSecrets.length > 0 && (
            <Text size="T200" style={{ color: color.Critical.Main }}>
              {pickedSecrets.join(', ')} may hold passwords or tokens. Anyone who can see the repo
              can read them, even after they&apos;re deleted.
            </Text>
          )}
          {changes.some((c) => isSecretFile(c.path) && excluded.has(c.path)) && (
            <Text size="T200" priority="300">
              Secret files like .env are left out. Tick one only if you mean to commit it.
            </Text>
          )}
          <Box gap="300" alignItems="Center" wrap="Wrap">
            <Box as="label" gap="100" alignItems="Center">
              <input type="radio" checked={!toNewBranch} onChange={() => setToNewBranch(false)} />
              <Text size="T200">
                Commit to <code>{gh.branch}</code>
              </Text>
            </Box>
            <Box as="label" gap="100" alignItems="Center">
              <input type="radio" checked={toNewBranch} onChange={() => setToNewBranch(true)} />
              <Text size="T200">New branch</Text>
            </Box>
            {toNewBranch && (
              <Input
                value={newBranch}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewBranch(e.target.value)}
                size="300"
                variant="Secondary"
                radii="300"
                placeholder="feature/my-change"
                style={{ minWidth: toRem(180) }}
              />
            )}
            <Box grow="Yes" />
            <Button
              size="300"
              variant="Primary"
              fill="Solid"
              radii="300"
              disabled={
                committing ||
                !snapshot ||
                picked.length === 0 ||
                !message.trim() ||
                (toNewBranch && !newBranch.trim())
              }
              before={
                committing ? <Spinner size="100" variant="Primary" fill="Solid" /> : undefined
              }
              onClick={commit}
            >
              <Text size="B300">
                Commit {picked.length} file{picked.length === 1 ? '' : 's'} & Push
              </Text>
            </Button>
          </Box>
        </Box>
      )}
      <ErrorLine text={commitError} />
      {result && (
        <Box gap="200" alignItems="Center" wrap="Wrap">
          <Text size="T200" style={{ color: color.Success.Main }}>
            Pushed to <code>{result.branch}</code>.{' '}
            <a href={result.url} target="_blank" rel="noreferrer noopener">
              View commit
            </a>
          </Text>
          <Chip
            variant="Critical"
            fill="None"
            radii="Pill"
            disabled={undoing}
            onClick={undoCommit}
            before={undoing ? <Spinner size="50" variant="Critical" /> : undefined}
          >
            <Text size="B300">Uncommit</Text>
          </Chip>
        </Box>
      )}
      <DraftPullForm owner={gh.owner} repo={gh.repo} head={gh.branch} />
    </Panel>
  );
}

function RepoDetails({ linked, onRemove }: { linked: LinkedRepo; onRemove: () => void }) {
  const account = useAtomValue(githubAccountAtom);
  const [workspace, setWorkspace] = useAtom(workspaceAtom);
  const [, setSnapshots] = useAtom(snapshotsAtom);
  const navigate = useNavigate();
  const [info, setInfo] = useState<GitHubRepo>();
  const [branches, setBranches] = useState<GitHubBranch[]>();
  const [pulls, setPulls] = useState<GitHubPull[]>();
  const [branch, setBranch] = useState('');
  const [error, setError] = useState<string>();
  const [pulling, setPulling] = useState(false);
  const [newBranch, setNewBranch] = useState('');
  const [notice, setNotice] = useState<string>();
  const [reload, setReload] = useState(0);
  const [pending, setPending] = useState<{ snap: BranchSnapshot; branch: string; root: string }>();
  const [undo, setUndo] = useState<Workspace>();
  const { owner, repo } = linked;
  const onThisRepo = workspace.github?.owner === owner && workspace.github?.repo === repo;

  useEffect(() => {
    if (!account) return;
    setError(undefined);
    Promise.all([
      getRepo(account.token, owner, repo),
      listBranches(account.token, owner, repo),
      listPulls(account.token, owner, repo),
    ])
      .then(([r, b, p]) => {
        setInfo(r);
        setBranches(b);
        setPulls(p);
        setBranch((cur) => cur || (onThisRepo && workspace.github?.branch) || r.default_branch);
      })
      .catch((e) => setError(errorText(e, "Couldn't load this repo.")));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account, owner, repo, reload]);

  const target = useMemo(
    () => (branch ? { owner, repo, branch, root: projectRootFor(repo) } : undefined),
    [owner, repo, branch]
  );
  const { snapshot, loading, error: fetchError, refresh } = useBranchSnapshot(target);
  const comparable = onThisRepo && workspace.github?.branch === branch;
  const changes = useMemo(
    () =>
      comparable && snapshot ? diffFiles(workspace.files, snapshot.files, workspace.root) : [],
    [comparable, snapshot, workspace.files, workspace.root]
  );
  useEffect(() => {
    if (comparable && !snapshot && !loading) refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [comparable, branch]);

  // The branch's files under the workspace's folder name, so the two line up file by file.
  const pendingChanges = useMemo(() => {
    if (!pending) return [];
    const from = `${pending.root}/`;
    const renamed = pending.snap.files.map((f) =>
      f.path.startsWith(from) ? { ...f, path: `${workspace.root}/${f.path.slice(from.length)}` } : f
    );
    return diffFiles(workspace.files, renamed, workspace.root);
  }, [pending, workspace.files, workspace.root]);

  if (!account) return null;

  // Fetches the branch and shows how it differs from the workspace; nothing changes yet.
  const pullIntoWorkspace = async () => {
    if (!target) return;
    setPulling(true);
    setError(undefined);
    setNotice(undefined);
    try {
      const snap = await fetchBranch(account.token, owner, repo, branch, target.root);
      setSnapshots((all) => ({ ...all, [snapshotKey(target)]: snap }));
      setPending({ snap, branch, root: target.root });
    } catch (e) {
      setError(errorText(e, "Couldn't pull the branch."));
    } finally {
      setPulling(false);
    }
  };

  const confirmPull = () => {
    if (!pending) return;
    const { snap } = pending;
    setUndo(workspace);
    setWorkspace({
      root: pending.root,
      files: snap.files,
      starter: false,
      github: { owner, repo, branch: pending.branch },
    });
    setPending(undefined);
    setNotice(
      `Pulled ${snap.files.length} files from ${pending.branch}${
        snap.skipped ? ` (skipped ${snap.skipped} binary or large files)` : ''
      }.`
    );
  };

  const makeBranch = async () => {
    const name = newBranch.trim();
    const from = branches?.find((b) => b.name === branch);
    if (!from || !validBranchName(name)) {
      setError('Pick a branch to start from and a valid new branch name.');
      return;
    }
    try {
      await createBranch(account.token, owner, repo, name, from.commit.sha);
      setNewBranch('');
      setBranch(name);
      setUndo(undefined);
      setNotice(`Created ${name} from ${branch}.`);
      setReload((n) => n + 1);
    } catch (e) {
      setError(errorText(e, "Couldn't create the branch."));
    }
  };

  const startRepo = async () => {
    setPulling(true);
    setError(undefined);
    try {
      await initRepo(account.token, owner, repo);
      setUndo(undefined);
      setNotice('Added a README. The repo is ready to pull.');
      setReload((n) => n + 1);
    } catch (e) {
      setError(errorText(e, "Couldn't start the repo."));
    } finally {
      setPulling(false);
    }
  };
  const empty = branches?.length === 0;

  const takeFromBranch = (list: Change[]) =>
    setWorkspace((ws: Workspace) => ({ ...ws, files: takeRemote(ws.files, list, ws.root) }));

  return (
    <Panel>
      <Box gap="200" alignItems="Center" wrap="Wrap">
        <GitHubLogo />
        <Text size="H5">
          {owner}/{repo}
        </Text>
        {info?.private && (
          <Text size="L400" priority="300">
            private
          </Text>
        )}
        {info && info.permissions?.push === false && (
          <Text size="L400" style={{ color: color.Warning.Main }}>
            read only
          </Text>
        )}
        <Box grow="Yes" />
        {info && (
          <Chip
            as="a"
            href={info.html_url}
            target="_blank"
            rel="noreferrer noopener"
            variant="SurfaceVariant"
            radii="Pill"
          >
            <Text size="B300">Open on GitHub</Text>
          </Chip>
        )}
        <Chip variant="Critical" fill="None" radii="Pill" onClick={onRemove}>
          <Text size="B300">Remove</Text>
        </Chip>
      </Box>
      <ErrorLine text={error ?? fetchError} />
      {!branches && !error && <Spinner size="200" variant="Secondary" />}
      {empty && (
        <Box gap="200" alignItems="Center" wrap="Wrap">
          <Text size="T200" priority="300">
            This repo is empty. Add a README to create {info?.default_branch ?? 'main'}, then pull
            it and commit as usual.
          </Text>
          <Button
            size="300"
            variant="Primary"
            fill="Solid"
            radii="300"
            disabled={pulling || info?.permissions?.push === false}
            before={pulling ? <Spinner size="100" variant="Primary" fill="Solid" /> : undefined}
            onClick={startRepo}
          >
            <Text size="B300">Add README</Text>
          </Button>
        </Box>
      )}
      {branches && !empty && (
        <Box gap="200" alignItems="Center" wrap="Wrap">
          <Text size="L400">Branch</Text>
          <select
            value={branch}
            onChange={(e) => setBranch(e.target.value)}
            aria-label="Branch"
            style={{ ...selectStyle, minWidth: toRem(120) }}
          >
            {branches.map((b) => (
              <option key={b.name} value={b.name}>
                {b.name}
                {b.name === info?.default_branch ? ' (default)' : ''}
              </option>
            ))}
          </select>
          <Button
            size="300"
            variant="Primary"
            fill="Solid"
            radii="300"
            disabled={pulling || !branch}
            before={
              pulling ? (
                <Spinner size="100" variant="Primary" fill="Solid" />
              ) : (
                <Icon size="100" src={Icons.Download} />
              )
            }
            onClick={pullIntoWorkspace}
          >
            <Text size="B300">Pull into Workspace</Text>
          </Button>
          {comparable && (
            <Chip
              variant="SurfaceVariant"
              radii="Pill"
              onClick={() => navigate(getHomeDeveloperPath('build'))}
            >
              <Text size="B300">Edit & Commit in Build Tools</Text>
            </Chip>
          )}
        </Box>
      )}
      {branches && !empty && (
        <Box gap="200" alignItems="Center" wrap="Wrap">
          <Input
            value={newBranch}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewBranch(e.target.value)}
            size="300"
            variant="Secondary"
            radii="300"
            placeholder="new-branch-name"
            style={{ minWidth: toRem(200) }}
          />
          <Chip
            variant="SurfaceVariant"
            radii="Pill"
            disabled={!newBranch.trim()}
            onClick={makeBranch}
          >
            <Text size="B300">Create Branch from {branch || '...'}</Text>
          </Chip>
        </Box>
      )}
      {pending && (
        <Box
          direction="Column"
          gap="200"
          style={{
            borderTop: `1px solid ${color.Background.ContainerLine}`,
            paddingTop: config.space.S300,
          }}
        >
          <Box gap="200" alignItems="Center" wrap="Wrap">
            <Text size="L400">
              {pendingChanges.length === 0
                ? `Your workspace already matches ${pending.branch}.`
                : `${pendingChanges.length} file${
                    pendingChanges.length === 1 ? '' : 's'
                  } differ between ${pending.branch} and your workspace (${workspace.root})`}
            </Text>
            <Box grow="Yes" />
            <Button size="300" variant="Primary" fill="Solid" radii="300" onClick={confirmPull}>
              <Text size="B300">Replace Workspace with {pending.branch}</Text>
            </Button>
            <Chip variant="SurfaceVariant" radii="Pill" onClick={() => setPending(undefined)}>
              <Text size="B300">Cancel</Text>
            </Chip>
          </Box>
          {pendingChanges.length > 0 && (
            <DiffReview
              changes={pendingChanges}
              remoteName={pending.branch}
              onTakeRemote={takeFromBranch}
            />
          )}
        </Box>
      )}
      {notice && (
        <Box gap="200" alignItems="Center" wrap="Wrap">
          <Text size="T200" style={{ color: color.Success.Main }}>
            {notice}
          </Text>
          {undo && (
            <Chip
              variant="SurfaceVariant"
              radii="Pill"
              onClick={() => {
                setWorkspace(undo);
                setUndo(undefined);
                setNotice('Restored your previous workspace.');
              }}
            >
              <Text size="B300">Undo</Text>
            </Chip>
          )}
        </Box>
      )}
      {comparable && snapshot && (
        <Box direction="Column" gap="200">
          <Text size="L400">
            {changes.length === 0
              ? `The editor matches ${branch}.`
              : `${changes.length} file${changes.length === 1 ? '' : 's'} differ from ${branch}`}
          </Text>
          {changes.length > 0 && (
            <DiffReview changes={changes} remoteName={branch} onTakeRemote={takeFromBranch} />
          )}
        </Box>
      )}
      {!comparable && branches && !empty && (
        <Text size="T200" priority="300">
          Pull this branch into the workspace to edit it, review diffs and commit.
        </Text>
      )}
      {pulls && (
        <Box direction="Column" gap="100">
          <Text size="L400">Open Pull Requests</Text>
          {pulls.length === 0 && (
            <Text size="T200" priority="300">
              None.
            </Text>
          )}
          {pulls.map((p) => (
            <Box key={p.number} gap="200" alignItems="Center">
              <a href={p.html_url} target="_blank" rel="noreferrer noopener">
                <Text size="T300">
                  #{p.number} {p.title}
                </Text>
              </a>
              <Text size="T200" priority="300">
                {p.head.ref} into {p.base.ref} · @{p.user.login}
                {p.draft ? ' · draft' : ''}
              </Text>
            </Box>
          ))}
        </Box>
      )}
    </Panel>
  );
}

// The Linked Developer Repos page.
export function DeveloperRepos() {
  const { account, unlink } = useGitHub();
  const [linked, setLinked] = useAtom(linkedReposAtom);
  const workspace = useAtomValue(workspaceAtom);
  const [picking, setPicking] = useState(false);
  const [selected, setSelected] = useState<string>();
  const [relinking, setRelinking] = useState(false);
  const expired = useGitHubExpired();

  if (!account) {
    return (
      <Box direction="Column" gap="300">
        <Panel>
          <LinkGitHubButton />
        </Panel>
      </Box>
    );
  }

  const keyOf = (r: LinkedRepo) => `${r.owner}/${r.repo}`;
  const inWorkspace = workspace.github && keyOf(workspace.github);
  const current =
    linked.find((r) => keyOf(r) === selected) ??
    linked.find((r) => keyOf(r) === inWorkspace) ??
    linked[0];

  return (
    <Box direction="Column" gap="400">
      <Panel>
        <Box gap="200" alignItems="Center" wrap="Wrap">
          {account.avatarUrl && (
            <img
              src={account.avatarUrl}
              alt=""
              width={28}
              height={28}
              style={{ borderRadius: '50%' }}
            />
          )}
          <Text size="T300">
            Linked as <b>@{account.login}</b>
          </Text>
          <Box grow="Yes" />
          <RelinkChip open={relinking || expired} onClick={() => setRelinking((v) => !v)} />
          <Chip
            variant={picking ? 'Primary' : 'SurfaceVariant'}
            radii="Pill"
            disabled={expired}
            onClick={() => setPicking((v) => !v)}
            before={<Icon size="50" src={Icons.Plus} />}
          >
            <Text size="B300">Connect a Repo</Text>
          </Chip>
          <Chip
            variant="Critical"
            fill="None"
            radii="Pill"
            onClick={() => {
              if (window.confirm('Unlink GitHub? Angaara loses access to your repos.')) unlink();
            }}
          >
            <Text size="B300">Unlink GitHub</Text>
          </Chip>
        </Box>
        {(relinking || expired) && (
          <RelinkBox expired={expired} onDone={() => setRelinking(false)} />
        )}
        {picking && !expired && (
          <RepoPicker
            onPick={(r) => {
              const repo = { owner: r.owner.login, repo: r.name };
              setLinked((list) =>
                list.some((l) => keyOf(l) === keyOf(repo)) ? list : [...list, repo]
              );
              setSelected(keyOf(repo));
              setPicking(false);
            }}
          />
        )}
        {linked.length > 1 && (
          <Box gap="100" wrap="Wrap">
            {linked.map((r) => (
              <Chip
                key={keyOf(r)}
                variant={current && keyOf(r) === keyOf(current) ? 'Primary' : 'SurfaceVariant'}
                radii="Pill"
                onClick={() => setSelected(keyOf(r))}
              >
                <Text size="B300">{keyOf(r)}</Text>
              </Chip>
            ))}
          </Box>
        )}
      </Panel>
      {current ? (
        <RepoDetails
          key={keyOf(current)}
          linked={current}
          onRemove={() => setLinked((list) => list.filter((r) => keyOf(r) !== keyOf(current)))}
        />
      ) : (
        <Text size="T300" priority="300">
          Connect a repo to pull it into the editor, review diffs, commit and open pull requests.
        </Text>
      )}
    </Box>
  );
}

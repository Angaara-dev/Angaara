// Angaara accounts: one username and passkeys, linked to up to a few Matrix accounts on any
// server, so perks like Supporter follow you around. Only public keys are stored.
// Supporter can only be changed from the separate angaara-supporters admin Worker.
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from '@simplewebauthn/server';
import { verifyOpenId } from './perks.js';

const MINUTE = 60 * 1000;
const CHALLENGE_TTL = 5 * MINUTE;
const MAX_LINKS = 3;
const MAX_PASSKEYS = 10;
const USERNAME_RE = /^[a-z0-9_.]{3,20}$/;
const RESERVED = new Set([
  'admin',
  'angaara',
  'support',
  'staff',
  'root',
  'system',
  'mod',
  'official',
]);

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });

const b64url = {
  encode: (bytes) =>
    btoa(String.fromCharCode(...bytes))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, ''),
  decode: (text) =>
    Uint8Array.from(atob(text.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0)),
};

let tablesReady;
const ensureTables = (db) => {
  tablesReady ??= db
    .batch([
      db.prepare(
        `CREATE TABLE IF NOT EXISTS angaara_accounts (
          id TEXT PRIMARY KEY,
          username TEXT NOT NULL UNIQUE,
          created INTEGER NOT NULL,
          supporter INTEGER NOT NULL DEFAULT 0
        )`
      ),
      db.prepare(
        `CREATE TABLE IF NOT EXISTS angaara_passkeys (
          id TEXT PRIMARY KEY,
          account_id TEXT NOT NULL,
          public_key TEXT NOT NULL,
          counter INTEGER NOT NULL DEFAULT 0,
          transports TEXT,
          created INTEGER NOT NULL
        )`
      ),
      db.prepare(
        `CREATE TABLE IF NOT EXISTS angaara_links (
          user_id TEXT PRIMARY KEY,
          account_id TEXT NOT NULL,
          linked INTEGER NOT NULL
        )`
      ),
      db.prepare(
        `CREATE TABLE IF NOT EXISTS angaara_challenges (
          user_id TEXT PRIMARY KEY,
          challenge TEXT NOT NULL,
          kind TEXT NOT NULL,
          username TEXT,
          expires INTEGER NOT NULL
        )`
      ),
    ])
    .catch((err) => {
      tablesReady = undefined;
      throw err;
    });
  return tablesReady;
};

const accountOf = (db, userId) =>
  db
    .prepare(
      `SELECT a.* FROM angaara_links l JOIN angaara_accounts a ON a.id = l.account_id
       WHERE l.user_id = ?`
    )
    .bind(userId)
    .first();

// Public: only whether someone is a supporter, never their username or other accounts.
export async function isAngaaraSupporter(env, userId) {
  if (!env.XP_DB) return false;
  await ensureTables(env.XP_DB);
  return !!(await accountOf(env.XP_DB, userId))?.supporter;
}

const removeAccount = (db, accountId) =>
  db.batch([
    db.prepare('DELETE FROM angaara_links WHERE account_id = ?').bind(accountId),
    db.prepare('DELETE FROM angaara_passkeys WHERE account_id = ?').bind(accountId),
    db.prepare('DELETE FROM angaara_accounts WHERE id = ?').bind(accountId),
  ]);

// Unlink just this Matrix account; the Angaara account goes too if nothing else is linked.
async function unlinkAccount(env, userId) {
  const db = env.XP_DB;
  const account = await accountOf(db, userId);
  await db.prepare('DELETE FROM angaara_links WHERE user_id = ?').bind(userId).run();
  if (!account) return;
  const left = await db
    .prepare('SELECT COUNT(*) AS n FROM angaara_links WHERE account_id = ?')
    .bind(account.id)
    .first();
  if ((left?.n ?? 0) === 0) await removeAccount(db, account.id);
}

// Delete My Data: the whole Angaara account (Supporter, passkeys, every link). Returns all the
// Matrix accounts that were linked, so their other data can go as well.
export async function deleteAngaaraAccount(env, userId) {
  if (!env.XP_DB) return [userId];
  const db = env.XP_DB;
  await ensureTables(db);
  await db.prepare('DELETE FROM angaara_challenges WHERE user_id = ?').bind(userId).run();
  const account = await accountOf(db, userId);
  if (!account) return [userId];
  const links = await db
    .prepare('SELECT user_id FROM angaara_links WHERE account_id = ?')
    .bind(account.id)
    .all();
  await removeAccount(db, account.id);
  return [...new Set([userId, ...(links.results ?? []).map((r) => r.user_id)])];
}

const saveChallenge = (db, userId, kind, challenge, username = null) =>
  db
    .prepare(
      `INSERT INTO angaara_challenges (user_id, challenge, kind, username, expires)
       VALUES (?1, ?2, ?3, ?4, ?5)
       ON CONFLICT(user_id) DO UPDATE SET challenge = ?2, kind = ?3, username = ?4, expires = ?5`
    )
    .bind(userId, challenge, kind, username, Date.now() + CHALLENGE_TTL)
    .run();

// Each challenge works once, for the kind of step it was made for, and only for a few minutes.
const takeChallenge = async (db, userId, kind) => {
  const row = await db
    .prepare('DELETE FROM angaara_challenges WHERE user_id = ? RETURNING *')
    .bind(userId)
    .first();
  if (!row || row.kind !== kind || row.expires < Date.now()) return undefined;
  return row;
};

const summary = async (db, account) => {
  if (!account) return { account: null };
  const [links, keys] = await Promise.all([
    db.prepare('SELECT user_id FROM angaara_links WHERE account_id = ?').bind(account.id).all(),
    db
      .prepare('SELECT COUNT(*) AS n FROM angaara_passkeys WHERE account_id = ?')
      .bind(account.id)
      .first(),
  ]);
  return {
    account: {
      username: account.username,
      supporter: !!account.supporter,
      created: account.created,
      linked: (links.results ?? []).map((r) => r.user_id),
      passkeys: keys?.n ?? 0,
      maxLinks: MAX_LINKS,
    },
  };
};

async function handle(request, env, url, userId, body) {
  const db = env.XP_DB;
  const rpID = url.hostname;
  const { origin } = url;
  const step = url.pathname.slice('/api/id/'.length);
  const account = await accountOf(db, userId);

  if (step === 'me') return json(await summary(db, account));

  // New account, or a new passkey for the account this Matrix account is already linked to.
  if (step === 'register/options') {
    let username;
    if (account) {
      const keys = await db
        .prepare('SELECT COUNT(*) AS n FROM angaara_passkeys WHERE account_id = ?')
        .bind(account.id)
        .first();
      if ((keys?.n ?? 0) >= MAX_PASSKEYS)
        return json({ error: 'That account has enough passkeys.' }, 400);
      username = account.username;
    } else {
      username = String(body?.username ?? '')
        .trim()
        .toLowerCase();
      if (!USERNAME_RE.test(username) || RESERVED.has(username)) {
        return json({ error: 'Usernames are 3-20 lowercase letters, numbers, _ or .' }, 400);
      }
      const taken = await db
        .prepare('SELECT 1 FROM angaara_accounts WHERE username = ?')
        .bind(username)
        .first();
      if (taken) return json({ error: 'That username is taken.' }, 409);
    }
    const existing = account
      ? await db
          .prepare('SELECT id, transports FROM angaara_passkeys WHERE account_id = ?')
          .bind(account.id)
          .all()
      : { results: [] };
    const options = await generateRegistrationOptions({
      rpName: 'Angaara',
      rpID,
      userName: username,
      userDisplayName: username,
      attestationType: 'none',
      excludeCredentials: (existing.results ?? []).map((k) => ({
        id: k.id,
        transports: k.transports ? JSON.parse(k.transports) : undefined,
      })),
      authenticatorSelection: { residentKey: 'required', userVerification: 'required' },
    });
    await saveChallenge(db, userId, 'register', options.challenge, username);
    return json({ options });
  }

  if (step === 'register/verify') {
    const pending = await takeChallenge(db, userId, 'register');
    if (!pending) return json({ error: 'That took too long. Try again.' }, 400);
    let result;
    try {
      result = await verifyRegistrationResponse({
        response: body?.response,
        expectedChallenge: pending.challenge,
        expectedOrigin: origin,
        expectedRPID: rpID,
        requireUserVerification: true,
      });
    } catch {
      return json({ error: "The passkey couldn't be verified." }, 400);
    }
    if (!result.verified) return json({ error: "The passkey couldn't be verified." }, 400);
    const { credential } = result.registrationInfo;
    const now = Date.now();
    let accountId = account?.id;
    const writes = [];
    if (!accountId) {
      accountId = crypto.randomUUID();
      writes.push(
        db
          .prepare('INSERT INTO angaara_accounts (id, username, created) VALUES (?, ?, ?)')
          .bind(accountId, pending.username, now),
        db
          .prepare('INSERT INTO angaara_links (user_id, account_id, linked) VALUES (?, ?, ?)')
          .bind(userId, accountId, now)
      );
    }
    writes.push(
      db
        .prepare(
          'INSERT INTO angaara_passkeys (id, account_id, public_key, counter, transports, created) VALUES (?, ?, ?, ?, ?, ?)'
        )
        .bind(
          credential.id,
          accountId,
          b64url.encode(credential.publicKey),
          credential.counter,
          JSON.stringify(credential.transports ?? []),
          now
        )
    );
    try {
      await db.batch(writes);
    } catch {
      return json({ error: 'That username was just taken. Pick another.' }, 409);
    }
    return json(await summary(db, await accountOf(db, userId)));
  }

  // Signing in with a passkey links this Matrix account to the Angaara account.
  if (step === 'login/options') {
    if (account) return json({ error: 'This Matrix account is already linked.' }, 400);
    const options = await generateAuthenticationOptions({ rpID, userVerification: 'required' });
    await saveChallenge(db, userId, 'login', options.challenge);
    return json({ options });
  }

  if (step === 'login/verify') {
    const pending = await takeChallenge(db, userId, 'login');
    if (!pending) return json({ error: 'That took too long. Try again.' }, 400);
    const key = await db
      .prepare('SELECT * FROM angaara_passkeys WHERE id = ?')
      .bind(String(body?.response?.id ?? ''))
      .first();
    if (!key) return json({ error: "That passkey isn't linked to an Angaara account." }, 404);
    let result;
    try {
      result = await verifyAuthenticationResponse({
        response: body.response,
        expectedChallenge: pending.challenge,
        expectedOrigin: origin,
        expectedRPID: rpID,
        credential: {
          id: key.id,
          publicKey: b64url.decode(key.public_key),
          counter: key.counter,
          transports: key.transports ? JSON.parse(key.transports) : undefined,
        },
        requireUserVerification: true,
      });
    } catch {
      return json({ error: "The passkey couldn't be verified." }, 400);
    }
    if (!result.verified) return json({ error: "The passkey couldn't be verified." }, 400);
    const links = await db
      .prepare('SELECT COUNT(*) AS n FROM angaara_links WHERE account_id = ?')
      .bind(key.account_id)
      .first();
    if ((links?.n ?? 0) >= MAX_LINKS) {
      return json(
        { error: `An Angaara account can link at most ${MAX_LINKS} Matrix accounts.` },
        400
      );
    }
    await db.batch([
      db
        .prepare('UPDATE angaara_passkeys SET counter = ? WHERE id = ?')
        .bind(result.authenticationInfo.newCounter, key.id),
      db
        .prepare('INSERT INTO angaara_links (user_id, account_id, linked) VALUES (?, ?, ?)')
        .bind(userId, key.account_id, Date.now()),
    ]);
    return json(await summary(db, await accountOf(db, userId)));
  }

  if (step === 'unlink') {
    await unlinkAccount(env, userId);
    return json({ account: null });
  }

  return json({ error: 'not found' }, 404);
}

// The Angaara username linked to this Matrix account, if any.
export async function angaaraUsername(env, userId) {
  if (!env.XP_DB) return undefined;
  await ensureTables(env.XP_DB);
  return (await accountOf(env.XP_DB, userId))?.username;
}

// Deleting everything needs the account's own passkey, not just a Matrix sign-in.
export async function deleteCheckOptions(env, url, userId) {
  if (!env.XP_DB) return undefined;
  const db = env.XP_DB;
  await ensureTables(db);
  const account = await accountOf(db, userId);
  if (!account) return undefined;
  const keys = await db
    .prepare('SELECT id, transports FROM angaara_passkeys WHERE account_id = ?')
    .bind(account.id)
    .all();
  const options = await generateAuthenticationOptions({
    rpID: url.hostname,
    userVerification: 'required',
    allowCredentials: (keys.results ?? []).map((k) => ({
      id: k.id,
      transports: k.transports ? JSON.parse(k.transports) : undefined,
    })),
  });
  await saveChallenge(db, userId, 'delete', options.challenge, account.username);
  return { options, username: account.username };
}

// True only for a fresh passkey signature from this Matrix account's own Angaara account.
export async function verifyDeleteCheck(env, url, userId, response) {
  const db = env.XP_DB;
  const account = await accountOf(db, userId);
  if (!account) return true;
  const pending = await takeChallenge(db, userId, 'delete');
  if (!pending) return false;
  const key = await db
    .prepare('SELECT * FROM angaara_passkeys WHERE id = ? AND account_id = ?')
    .bind(String(response?.id ?? ''), account.id)
    .first();
  if (!key) return false;
  try {
    const result = await verifyAuthenticationResponse({
      response,
      expectedChallenge: pending.challenge,
      expectedOrigin: url.origin,
      expectedRPID: url.hostname,
      credential: {
        id: key.id,
        publicKey: b64url.decode(key.public_key),
        counter: key.counter,
        transports: key.transports ? JSON.parse(key.transports) : undefined,
      },
      requireUserVerification: true,
    });
    return result.verified;
  } catch {
    return false;
  }
}

export async function handleAngaaraId(request, env, url) {
  if (request.method !== 'POST') return json({ error: 'not found' }, 404);
  if (!env.XP_DB) return json({ error: 'not set up' }, 501);
  await ensureTables(env.XP_DB);
  const body = await request.json().catch(() => undefined);
  const userId = await verifyOpenId(body?.openid);
  if (!userId) return json({ error: 'not signed in' }, 401);
  return handle(request, env, url, userId, body);
}

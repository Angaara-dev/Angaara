// Perks: signed passes for time-earned GIF profiles, the supporter badge and early access.
// Parked, not wired into worker/index.js yet. Setup and secrets are in docs/PERKS.md.

export const GIF_DAYS = 30;
// Supporting is $2/month: each payment adds a month, plus a few days' grace for late renewals.
const SUPPORT_MS = 31 * 24 * 60 * 60 * 1000;
const GRACE_MS = 3 * 24 * 60 * 60 * 1000;
const MIN_AMOUNT = { USD: 2, EUR: 2, GBP: 2 };
// Short-lived, so a lapsed supporter's badge fades even if they never open the app again.
const PASS_MS = 3 * 24 * 60 * 60 * 1000;
const DEV_ENTER_MS = 2 * 60 * 1000;
const DEV_COOKIE = 'angaara_dev';
const DEV_COOKIE_MS = 30 * 24 * 60 * 60 * 1000;

const enc = new TextEncoder();
const b64url = (bytes) =>
  btoa(String.fromCharCode(...new Uint8Array(bytes)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
const fromB64url = (s) =>
  Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));

const json = (data, status = 200, extra = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...extra },
  });

// Any Angaara build may call these (auth is the OpenID token in the body), so CORS is open.
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
};

const safeEqual = (a, b) => {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
};

const readCookie = (request, name) =>
  (request.headers.get('Cookie') ?? '')
    .split(';')
    .map((c) => c.trim().split('='))
    .find(([key]) => key === name)?.[1];

// Hostnames only (optional port): no IPs, localhost or internal names, so this can't be aimed inward.
const HOST_RE = /^(?=.{1,253}(:|$))([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}(:\d{1,5})?$/i;
const BLOCKED_TLD = /\.(local|localhost|internal|lan|home|corp|arpa|test|invalid)(:\d+)?$/i;
const validHost = (host) =>
  typeof host === 'string' && HOST_RE.test(host) && !BLOCKED_TLD.test(host);

const MXID_RE = /^@[a-z0-9._=\-/+]{1,255}:([a-z0-9.-]{1,253}(:\d{1,5})?)$/i;

const timed = (ms) => AbortSignal.timeout(ms);

// Where to reach a server's federation API: explicit port, then .well-known, then :8448.
async function federationBase(serverName) {
  if (/:\d+$/.test(serverName)) return `https://${serverName}`;
  try {
    const res = await fetch(`https://${serverName}/.well-known/matrix/server`, {
      signal: timed(5000),
      redirect: 'follow',
    });
    if (res.ok) {
      const delegated = (await res.json())?.['m.server'];
      if (validHost(delegated)) {
        return /:\d+$/.test(delegated) ? `https://${delegated}` : `https://${delegated}:8448`;
      }
    }
  } catch {
    // No delegation: fall through to the default port.
  }
  return `https://${serverName}:8448`;
}

// Asks the user's own homeserver who this OpenID token belongs to (the standard Matrix check).
export async function verifyOpenId(body) {
  const token = body?.access_token;
  const serverName = body?.matrix_server_name;
  if (typeof token !== 'string' || !/^[\w.~+/=-]{8,512}$/.test(token)) return undefined;
  if (!validHost(serverName)) return undefined;
  const base = await federationBase(serverName.toLowerCase());
  const url = `${base}/_matrix/federation/v1/openid/userinfo?access_token=${encodeURIComponent(
    token
  )}`;
  try {
    const res = await fetch(url, { signal: timed(5000), redirect: 'manual' });
    if (!res.ok) return undefined;
    const sub = (await res.json())?.sub;
    const match = typeof sub === 'string' ? MXID_RE.exec(sub) : null;
    // The server may only vouch for its own users.
    if (!match || match[1].toLowerCase() !== serverName.toLowerCase()) return undefined;
    return sub;
  } catch {
    return undefined;
  }
}

let keyCache;
const signingKey = (env) => {
  keyCache ??= crypto.subtle.importKey(
    'jwk',
    JSON.parse(env.PERKS_SIGNING_KEY),
    { name: 'Ed25519' },
    false,
    ['sign']
  );
  return keyCache;
};
let verifyCache;
const verifyKey = (env) => {
  verifyCache ??= crypto.subtle.importKey(
    'jwk',
    JSON.parse(env.PERKS_PUBLIC_KEY),
    { name: 'Ed25519' },
    false,
    ['verify']
  );
  return verifyCache;
};

// Pass format: "v1.<payload>.<signature>", Ed25519 over "v1.<payload>".
async function sign(env, payload) {
  const head = `v1.${b64url(enc.encode(JSON.stringify(payload)))}`;
  const sig = await crypto.subtle.sign(
    { name: 'Ed25519' },
    await signingKey(env),
    enc.encode(head)
  );
  return `${head}.${b64url(sig)}`;
}

async function verify(env, pass, aud) {
  if (typeof pass !== 'string' || pass.length > 4096) return undefined;
  const parts = pass.split('.');
  if (parts.length !== 3 || parts[0] !== 'v1') return undefined;
  try {
    const ok = await crypto.subtle.verify(
      { name: 'Ed25519' },
      await verifyKey(env),
      fromB64url(parts[2]),
      enc.encode(`${parts[0]}.${parts[1]}`)
    );
    if (!ok) return undefined;
    const payload = JSON.parse(new TextDecoder().decode(fromB64url(parts[1])));
    if (payload.aud !== aud || typeof payload.exp !== 'number' || payload.exp < Date.now()) {
      return undefined;
    }
    return payload;
  } catch {
    return undefined;
  }
}

const today = () => new Date().toISOString().slice(0, 10);

async function loadUser(env, sub) {
  const [activity, support] = await Promise.all([
    env.PERKS_KV.get(`u:${sub}`, 'json'),
    env.PERKS_KV.get(`s:${sub}`, 'json'),
  ]);
  return { activity: activity ?? { days: 0, last: '' }, support };
}

const perksOf = ({ activity, support }) => {
  const perks = [];
  if (activity.days >= GIF_DAYS) perks.push('animated_profile');
  if (support && support.until + GRACE_MS > Date.now()) perks.push('supporter', 'early_access');
  return perks;
};

const passFor = (env, sub, user) =>
  sign(env, {
    aud: 'angaara-perks',
    sub,
    perks: perksOf(user),
    iat: Date.now(),
    exp: Date.now() + PASS_MS,
  });

// Runs on every app open; still counts at most one active day per account per day.
async function checkIn(env, sub) {
  const user = await loadUser(env, sub);
  const day = today();
  if (user.activity.last !== day) {
    user.activity = { days: user.activity.days + 1, last: day };
    await env.PERKS_KV.put(`u:${sub}`, JSON.stringify(user.activity));
  }
  return { pass: await passFor(env, sub, user), days: user.activity.days };
}

// Renewals may arrive without the message, so payers are matched by a keyed hash of their email.
async function emailKey(env, email) {
  if (!env.PERKS_EMAIL_PEPPER || typeof email !== 'string' || !email.includes('@'))
    return undefined;
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(env.PERKS_EMAIL_PEPPER),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const mac = await crypto.subtle.sign('HMAC', key, enc.encode(email.trim().toLowerCase()));
  return `e:${b64url(mac)}`;
}

// Ko-fi webhook: the first payment's message carries the supporter's Matrix ID.
async function kofi(request, env) {
  const form = await request.formData().catch(() => undefined);
  let data;
  try {
    data = JSON.parse(form?.get('data') ?? '');
  } catch {
    return json({ error: 'bad payload' }, 400);
  }
  if (
    !env.KOFI_VERIFICATION_TOKEN ||
    !safeEqual(data?.verification_token, env.KOFI_VERIFICATION_TOKEN)
  ) {
    return json({ error: 'forbidden' }, 403);
  }
  // Still 200 below, so Ko-fi doesn't retry payments we just don't count.
  const min = MIN_AMOUNT[String(data.currency).toUpperCase()];
  if (!min || !(Number(data.amount) >= min)) return json({ ok: true, linked: false });

  const byEmail = await emailKey(env, data.email);
  const named = /@[a-z0-9._=\-/+]{1,255}:[a-z0-9.-]{1,253}(:\d{1,5})?/i.exec(
    data.message ?? ''
  )?.[0];
  const sub = named ?? (byEmail ? await env.PERKS_KV.get(byEmail) : undefined);
  if (!sub) return json({ ok: true, linked: false });
  if (named && byEmail) await env.PERKS_KV.put(byEmail, named);

  const prev = await env.PERKS_KV.get(`s:${sub}`, 'json');
  const until = Math.max(prev?.until ?? 0, Date.now()) + SUPPORT_MS;
  await env.PERKS_KV.put(`s:${sub}`, JSON.stringify({ since: prev?.since ?? Date.now(), until }));
  return json({ ok: true, linked: true });
}

export async function handlePerks(request, env, url) {
  if (!env.PERKS_KV || !env.PERKS_SIGNING_KEY || !env.PERKS_PUBLIC_KEY) {
    return json({ error: 'perks not configured' }, 501, CORS);
  }
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (request.method !== 'POST') return json({ error: 'method not allowed' }, 405, CORS);

  if (url.pathname === '/api/perks/kofi') return kofi(request, env);

  const body = await request.json().catch(() => undefined);
  const sub = await verifyOpenId(body);
  if (!sub) return json({ error: 'sign-in check failed' }, 401, CORS);

  if (url.pathname === '/api/perks/checkin') {
    // The day count only goes back to you; the published pass doesn't show it.
    const { pass, days } = await checkIn(env, sub);
    return json({ pass, days, unlockDays: GIF_DAYS }, 200, CORS);
  }

  if (url.pathname === '/api/perks/dev-link') {
    if (!env.DEV_ORIGIN) return json({ error: 'no early access site' }, 501, CORS);
    const user = await loadUser(env, sub);
    if (!perksOf(user).includes('early_access'))
      return json({ error: 'supporters only' }, 403, CORS);
    const token = await sign(env, {
      aud: 'dev-enter',
      sub,
      until: user.support.until,
      exp: Date.now() + DEV_ENTER_MS,
    });
    return json(
      { url: `${env.DEV_ORIGIN}/api/perks/enter?t=${encodeURIComponent(token)}` },
      200,
      CORS
    );
  }

  return json({ error: 'not found' }, 404, CORS);
}

const gatePage = () =>
  new Response(
    `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width">
<title>Angaara Early Access</title>
<p style="font-family:sans-serif;padding:24px">Early access is for Angaara supporters.
Open it from Settings in the main app.</p>`,
    {
      status: 403,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
        'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'",
      },
    }
  );

// For the early access deploy (DEV_GATE=1): every request needs the supporter cookie.
export async function devGate(request, env, url) {
  if (url.pathname === '/api/perks/enter') {
    const enter = await verify(env, url.searchParams.get('t'), 'dev-enter');
    if (!enter) return gatePage();
    // Access ends with the support period, so a lapsed supporter can't keep an old cookie going.
    const exp = Math.min(Date.now() + DEV_COOKIE_MS, enter.until ?? 0);
    const cookie = await sign(env, { aud: 'dev', sub: enter.sub, exp });
    return new Response(null, {
      status: 302,
      headers: {
        Location: '/',
        'Cache-Control': 'no-store',
        'Referrer-Policy': 'no-referrer',
        'Set-Cookie': `${DEV_COOKIE}=${cookie}; Path=/; Max-Age=${Math.max(
          0,
          Math.floor((exp - Date.now()) / 1000)
        )}; HttpOnly; Secure; SameSite=Lax`,
      },
    });
  }
  const session = await verify(env, readCookie(request, DEV_COOKIE), 'dev');
  return session ? undefined : gatePage();
}

// Serves the app, plus GitHub sign-in, the XP counter, appeal settings, reports and data deletion.
// Secrets: GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET (set with `wrangler secret put`).

// Perks are parked until launch; uncomment these lines and the ones in fetch() to turn them on.
// import { devGate, handlePerks } from './perks.js';
import { handleXp } from './xp.js';
import { handleAppeals } from './appeals.js';
import { handleReports } from './reports.js';
import { handleAccount } from './account.js';

const STATE_COOKIE = 'gh_oauth_state';
const SCOPE = 'repo';

const randomHex = (bytes) =>
  [...crypto.getRandomValues(new Uint8Array(bytes))]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

const readCookie = (request, name) =>
  (request.headers.get('Cookie') ?? '')
    .split(';')
    .map((c) => c.trim().split('='))
    .find(([key]) => key === name)?.[1];

// Constant-time compare, so the state check doesn't leak timing.
const safeEqual = (a, b) => {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
};

// Hands the result to the Angaara tab that opened this popup, then closes.
const resultPage = (origin, message) => {
  const payload = JSON.stringify({ type: 'angaara-github-auth', ...message }).replace(
    /</g,
    '\\u003c'
  );
  const nonce = randomHex(16);
  const body = `<!doctype html><meta charset="utf-8"><title>GitHub</title>
<p style="font-family:sans-serif">${
    message.error
      ? 'GitHub sign-in failed. You can close this window.'
      : 'Signed in. You can close this window.'
  }</p>
<script nonce="${nonce}">
if (window.opener) window.opener.postMessage(${payload}, ${JSON.stringify(origin)});
window.close();
</script>`;
  return new Response(body, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'Referrer-Policy': 'no-referrer',
      'Content-Security-Policy': `default-src 'none'; script-src 'nonce-${nonce}'; style-src 'unsafe-inline'`,
      'Set-Cookie': `${STATE_COOKIE}=; Path=/api/github; Max-Age=0; HttpOnly; Secure; SameSite=Lax`,
    },
  });
};

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });

async function handleGitHub(request, env, url) {
  const configured = !!(env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET);
  const callback = `${url.origin}/api/github/callback`;

  if (url.pathname === '/api/github/status') return json({ configured });
  if (!configured) {
    return url.pathname === '/api/github/callback' || url.pathname === '/api/github/login'
      ? resultPage(url.origin, { error: 'GitHub sign-in is not set up on this server.' })
      : json({ error: 'not configured' }, 501);
  }

  if (url.pathname === '/api/github/login' && request.method === 'GET') {
    const state = randomHex(32);
    const authorize = new URL('https://github.com/login/oauth/authorize');
    authorize.searchParams.set('client_id', env.GITHUB_CLIENT_ID);
    authorize.searchParams.set('redirect_uri', callback);
    authorize.searchParams.set('scope', SCOPE);
    authorize.searchParams.set('state', state);
    authorize.searchParams.set('allow_signup', 'false');
    return new Response(null, {
      status: 302,
      headers: {
        Location: authorize.toString(),
        'Cache-Control': 'no-store',
        'Set-Cookie': `${STATE_COOKIE}=${state}; Path=/api/github; Max-Age=600; HttpOnly; Secure; SameSite=Lax`,
      },
    });
  }

  if (url.pathname === '/api/github/callback' && request.method === 'GET') {
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    if (!code || !safeEqual(state, readCookie(request, STATE_COOKIE))) {
      return resultPage(url.origin, { error: 'Sign-in expired or was tampered with. Try again.' });
    }
    const res = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: env.GITHUB_CLIENT_ID,
        client_secret: env.GITHUB_CLIENT_SECRET,
        code,
        redirect_uri: callback,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!data.access_token) return resultPage(url.origin, { error: 'GitHub refused the sign-in.' });
    return resultPage(url.origin, { token: data.access_token });
  }

  // Revokes the app's grant so the token stops working everywhere, not just in this browser.
  if (url.pathname === '/api/github/revoke' && request.method === 'POST') {
    if (request.headers.get('Origin') !== url.origin) return json({ error: 'forbidden' }, 403);
    const { token } = await request.json().catch(() => ({}));
    if (typeof token !== 'string' || token.length > 255) return json({ error: 'bad token' }, 400);
    const auth = btoa(`${env.GITHUB_CLIENT_ID}:${env.GITHUB_CLIENT_SECRET}`);
    const res = await fetch(`https://api.github.com/applications/${env.GITHUB_CLIENT_ID}/grant`, {
      method: 'DELETE',
      headers: {
        Authorization: `Basic ${auth}`,
        Accept: 'application/vnd.github+json',
        'User-Agent': 'Angaara',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ access_token: token }),
    });
    return json({ revoked: res.status === 204 || res.status === 404 });
  }

  return json({ error: 'not found' }, 404);
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    // if (env.DEV_GATE === '1') {
    //   const blocked = await devGate(request, env, url);
    //   if (blocked) return blocked;
    // }
    // if (url.pathname.startsWith('/api/perks/')) return handlePerks(request, env, url);
    if (url.pathname.startsWith('/api/github/')) return handleGitHub(request, env, url);
    if (url.pathname.startsWith('/api/xp/')) return handleXp(request, env, url);
    if (url.pathname.startsWith('/api/account/')) return handleAccount(request, env, url);
    if (url.pathname.startsWith('/api/appeals/')) return handleAppeals(request, env, url, ctx);
    if (url.pathname === '/api/reports' || url.pathname.startsWith('/api/reports/')) {
      return handleReports(request, env, url);
    }
    return env.ASSETS.fetch(request);
  },
};

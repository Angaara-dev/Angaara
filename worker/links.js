// Link and file checks. Links: follows redirects and reads a little of the page in the Worker
// (no page code runs), then looks for scam signs. Files: only a fingerprint is looked up.
// Nothing about what was checked is kept.
import { verifyOpenId } from './perks.js';
import { badgeHolders } from './badges.js';

const DAY = 24 * 60 * 60 * 1000;
// Checks per account every two months; supporters help pay for them, so they get more.
const WINDOW = 60 * DAY;
const MAX_CHECKS = 20;
const MAX_CHECKS_SUPPORTER = 300;
const MAX_HOPS = 6;
const MAX_BYTES = 128 * 1024;
const TIMEOUT = 6000;

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });

// Brands scammers imitate most; a near miss of one of these is a strong warning sign.
const BRANDS = [
  'google',
  'paypal',
  'apple',
  'icloud',
  'microsoft',
  'outlook',
  'office',
  'amazon',
  'facebook',
  'instagram',
  'whatsapp',
  'discord',
  'steam',
  'steamcommunity',
  'github',
  'netflix',
  'spotify',
  'twitter',
  'telegram',
  'binance',
  'coinbase',
  'metamask',
  'roblox',
  'epicgames',
  'matrix',
  'element',
  'angaara',
  'proton',
  'protonmail',
  'chase',
  'wellsfargo',
  'dropbox',
  'linkedin',
];
// Second-level parts that sit under a country code, like co.uk.
const SECOND_LEVELS = new Set(['co', 'com', 'net', 'org', 'gov', 'ac', 'edu']);
const DOWNLOADS = /\.(exe|msi|scr|bat|cmd|ps1|vbs|js|jar|apk|dmg|pkg|app|iso|img|lnk|hta|dll)$/i;
const DOWNLOAD_TYPES =
  /(x-msdownload|x-msi|x-dosexec|java-archive|android\.package|x-apple-diskimage)/i;

const registrable = (host) => {
  const parts = host.split('.');
  if (parts.length <= 2) return host;
  const sld = parts[parts.length - 2];
  const take = SECOND_LEVELS.has(sld) && parts[parts.length - 1].length === 2 ? 3 : 2;
  return parts.slice(-take).join('.');
};

// Undoes common letter swaps (paypa1, g00gle) before comparing to brand names.
const unswap = (s) =>
  s
    .replace(/0/g, 'o')
    .replace(/[1l|]/g, 'l')
    .replace(/3/g, 'e')
    .replace(/5/g, 's')
    .replace(/rn/g, 'm');

const editDistance = (a, b) => {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    let prev = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const cur = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = cur;
    }
  }
  return row[b.length];
};

// A domain that looks like a brand but isn't it.
const lookalike = (domain) => {
  const name = domain.split('.')[0];
  const plain = unswap(name.replace(/-/g, ''));
  return BRANDS.find(
    (brand) =>
      name !== brand && (plain === brand || (brand.length >= 5 && editDistance(plain, brand) === 1))
  );
};

// A brand's name dressed up as part of someone else's domain, like paypal.com.secure-login.xyz.
const brandInSubdomain = (host, domain) => {
  const sub = host.slice(0, -domain.length);
  return BRANDS.find((brand) => sub.includes(`${brand}.`) || sub.includes(`${brand}-`));
};

const fetchHop = (url) =>
  fetch(url, {
    method: 'GET',
    redirect: 'manual',
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; AngaaraLinkCheck/1.0)', Accept: '*/*' },
    signal: AbortSignal.timeout(TIMEOUT),
  });

const readSome = async (res) => {
  if (!res.body) return '';
  const reader = res.body.getReader();
  const chunks = [];
  let size = 0;
  while (size < MAX_BYTES) {
    // eslint-disable-next-line no-await-in-loop
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    size += value.length;
  }
  reader.cancel().catch(() => undefined);
  return new TextDecoder().decode(
    chunks.reduce((all, c) => {
      const out = new Uint8Array(all.length + c.length);
      out.set(all);
      out.set(c, all.length);
      return out;
    }, new Uint8Array())
  );
};

// IANA's list of which registry answers RDAP lookups for each ending (.com, .xyz, ...).
let bootstrap;
const rdapBase = async (domain) => {
  bootstrap ??= fetch('https://data.iana.org/rdap/dns.json', {
    signal: AbortSignal.timeout(TIMEOUT),
  })
    .then((res) => res.json())
    .catch((err) => {
      bootstrap = undefined;
      throw err;
    });
  const tld = domain.split('.').pop();
  const base = (await bootstrap)?.services?.find(([tlds]) => tlds.includes(tld))?.[1]?.[0];
  return base ? base.replace(/\/?$/, '/') : undefined;
};

// When the domain was registered, asked straight from its registry.
const registeredAt = async (domain) => {
  try {
    const base = await rdapBase(domain);
    if (!base) return undefined;
    const res = await fetch(`${base}domain/${encodeURIComponent(domain)}`, {
      headers: { Accept: 'application/rdap+json' },
      signal: AbortSignal.timeout(TIMEOUT),
    });
    if (!res.ok) return undefined;
    const data = await res.json();
    const event = data?.events?.find((e) => e?.eventAction === 'registration');
    const at = event ? Date.parse(event.eventDate) : NaN;
    return Number.isFinite(at) ? at : undefined;
  } catch {
    return undefined;
  }
};

// abuse.ch's URLhaus list of known malware links; only used when its free key is set.
const knownMalware = async (env, url, host) => {
  if (!env.ABUSE_CH_KEY) return undefined;
  const ask = async (path, field, value) => {
    const res = await fetch(`https://urlhaus-api.abuse.ch/v1/${path}/`, {
      method: 'POST',
      headers: {
        'Auth-Key': env.ABUSE_CH_KEY,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `${field}=${encodeURIComponent(value)}`,
      signal: AbortSignal.timeout(TIMEOUT),
    });
    return res.ok ? res.json() : undefined;
  };
  try {
    const [byUrl, byHost] = await Promise.all([ask('url', 'url', url), ask('host', 'host', host)]);
    return byUrl?.query_status === 'ok' || byHost?.query_status === 'ok';
  } catch {
    return undefined;
  }
};

async function check(env, input) {
  const findings = [];
  const add = (level, text) => findings.push({ level, text });

  let url = new URL(input);
  const start = url;
  if (url.username || url.password) {
    add('bad', 'The link hides its real address behind a fake "name@" part.');
    url = new URL(url.href);
    url.username = '';
    url.password = '';
  }

  // Follow redirects one hop at a time, so every stop is seen.
  const hops = [url.href];
  let res;
  let failed;
  for (let i = 0; i <= MAX_HOPS; i += 1) {
    try {
      // eslint-disable-next-line no-await-in-loop
      res = await fetchHop(url.href);
    } catch (err) {
      failed = String(err?.message ?? err).slice(0, 120);
      break;
    }
    const next = res.status >= 300 && res.status < 400 ? res.headers.get('Location') : null;
    if (!next) break;
    res.body?.cancel().catch(() => undefined);
    url = new URL(next, url);
    hops.push(url.href);
    if (i === MAX_HOPS) add('warn', `It redirects more than ${MAX_HOPS} times.`);
  }

  const host = url.hostname.toLowerCase();
  const domain = registrable(host);
  const startDomain = registrable(start.hostname.toLowerCase());
  if (domain !== startDomain) {
    add('warn', `It redirects to a different site: ${domain}.`);
  }
  if (url.protocol === 'http:') add('warn', "The page isn't encrypted (http, not https).");
  if (/^\d+\.\d+\.\d+\.\d+$/.test(host) || host.includes(':')) {
    add('bad', 'It goes to a bare IP address instead of a named website.');
  }
  if (host.split('.').some((label) => label.startsWith('xn--'))) {
    add('warn', 'The address uses special characters that can imitate normal letters.');
  }
  // Every stop counts: a lookalike that forwards to the real site is still a trick.
  const seen = new Set();
  hops.forEach((hop) => {
    const hopHost = new URL(hop).hostname.toLowerCase();
    const hopDomain = registrable(hopHost);
    if (seen.has(hopHost)) return;
    seen.add(hopHost);
    const fake = lookalike(hopDomain);
    if (fake) add('bad', `${hopDomain} looks like ${fake}, but isn't it.`);
    const dressed = brandInSubdomain(hopHost, hopDomain);
    if (dressed && !fake && hopDomain.split('.')[0] !== dressed) {
      add('bad', `It uses "${dressed}" in the address, but the site is really ${hopDomain}.`);
    }
  });

  const [registered, malware] = await Promise.all([
    registeredAt(domain),
    knownMalware(env, url.href, host),
  ]);
  if (malware) add('bad', "It's on URLhaus, a public list of known malware links.");
  if (registered) {
    const days = Math.floor((Date.now() - registered) / DAY);
    if (days < 30)
      add('bad', `The domain was registered only ${days} day${days === 1 ? '' : 's'} ago.`);
    else if (days < 180) add('warn', `The domain is fairly new (${days} days old).`);
  }

  let title;
  if (failed) {
    add('warn', `The page couldn't be reached (${failed}).`);
  } else if (res) {
    const type = res.headers.get('Content-Type') ?? '';
    const disposition = res.headers.get('Content-Disposition') ?? '';
    const file = /filename\*?=(?:UTF-8'')?"?([^";]+)/i.exec(disposition)?.[1] ?? url.pathname;
    if (DOWNLOADS.test(file) || DOWNLOAD_TYPES.test(type)) {
      add(
        'bad',
        `It downloads a program or script (${decodeURIComponent(file.split('/').pop() ?? '')}).`
      );
    } else if (/text\/html/i.test(type)) {
      const html = await readSome(res).catch(() => '');
      title = /<title[^>]*>([^<]{1,200})/i.exec(html)?.[1]?.trim();
      if (/<input[^>]+type=["']?password/i.test(html)) {
        add(
          registered && Date.now() - registered < 180 * DAY ? 'bad' : 'warn',
          'The page asks for a password.'
        );
      }
    } else {
      res.body?.cancel().catch(() => undefined);
    }
    if (res.status >= 400) add('warn', `The site answered with an error (${res.status}).`);
  }
  if (malware === undefined && env.ABUSE_CH_KEY) {
    add('warn', "The known-malware list couldn't be checked right now.");
  }

  let verdict = 'ok';
  if (findings.some((f) => f.level === 'warn')) verdict = 'warn';
  if (findings.some((f) => f.level === 'bad')) verdict = 'bad';
  return {
    verdict,
    url: start.href,
    finalUrl: url.href,
    hops,
    domain,
    registered,
    title,
    findings,
    malwareListChecked: !!env.ABUSE_CH_KEY && malware !== undefined,
  };
}

// Counts one check, or says how long until the next is allowed. Only a hash of the account and
// a count are kept, never what was checked.
async function takeCheck(env, url, userId) {
  const limit = (await badgeHolders(env, url, 'supporter')).has(userId.toLowerCase())
    ? MAX_CHECKS_SUPPORTER
    : MAX_CHECKS;
  const db = env.XP_DB;
  if (!db) return { ok: true, limit, left: limit };
  await db
    .prepare(
      'CREATE TABLE IF NOT EXISTS link_check_rate (who TEXT PRIMARY KEY, window INTEGER NOT NULL, count INTEGER NOT NULL)'
    )
    .run();
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`links:${userId}`));
  const who = btoa(String.fromCharCode(...new Uint8Array(digest))).slice(0, 22);
  const now = Date.now();
  const rate = await db
    .prepare('SELECT window, count FROM link_check_rate WHERE who = ?')
    .bind(who)
    .first();
  const fresh = !rate || now - rate.window > WINDOW;
  const used = fresh ? 0 : rate.count;
  const resets = fresh ? now + WINDOW : rate.window + WINDOW;
  if (used >= limit) return { ok: false, limit, left: 0, resets };
  await db
    .prepare(
      `INSERT INTO link_check_rate (who, window, count) VALUES (?1, ?2, 1)
       ON CONFLICT(who) DO UPDATE SET
         window = CASE WHEN ?3 THEN ?2 ELSE window END,
         count = CASE WHEN ?3 THEN 1 ELSE count + 1 END`
    )
    .bind(who, now, fresh ? 1 : 0)
    .run();
  return { ok: true, limit, left: limit - used - 1, resets };
}

const outOfChecks = (quota) =>
  json(
    {
      error: `You've used all ${quota.limit} checks for now. More on ${new Date(
        quota.resets
      ).toDateString()}.`,
      quota,
    },
    429
  );

// MalwareBazaar, abuse.ch's list of known malware files, looked up by fingerprint only.
async function checkFile(env, sha256) {
  if (!env.ABUSE_CH_KEY) return { listed: undefined };
  try {
    const res = await fetch('https://mb-api.abuse.ch/api/v1/', {
      method: 'POST',
      headers: {
        'Auth-Key': env.ABUSE_CH_KEY,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `query=get_info&hash=${sha256}`,
      signal: AbortSignal.timeout(TIMEOUT),
    });
    const data = res.ok ? await res.json() : undefined;
    if (data?.query_status === 'ok') {
      const found = data.data?.[0];
      return { listed: true, name: found?.signature ?? found?.file_type ?? undefined };
    }
    return { listed: data?.query_status === 'hash_not_found' ? false : undefined };
  } catch {
    return { listed: undefined };
  }
}

export async function handleLinks(request, env, url) {
  const isLink = url.pathname === '/api/links/check';
  const isFile = url.pathname === '/api/links/file';
  if ((!isLink && !isFile) || request.method !== 'POST') return json({ error: 'not found' }, 404);
  const body = await request.json().catch(() => undefined);
  const userId = await verifyOpenId(body?.openid);
  if (!userId) return json({ error: 'not signed in' }, 401);

  if (isFile) {
    const sha256 = String(body?.sha256 ?? '').toLowerCase();
    if (!/^[0-9a-f]{64}$/.test(sha256)) return json({ error: 'bad fingerprint' }, 400);
    const quota = await takeCheck(env, url, userId);
    if (!quota.ok) return outOfChecks(quota);
    return json({ ...(await checkFile(env, sha256)), quota });
  }

  let target;
  try {
    target = new URL(String(body?.url ?? ''));
  } catch {
    return json({ error: 'bad link' }, 400);
  }
  if (!['http:', 'https:'].includes(target.protocol) || target.href.length > 2048) {
    return json({ error: 'Only web links (http or https) can be checked.' }, 400);
  }
  const quota = await takeCheck(env, url, userId);
  if (!quota.ok) return outOfChecks(quota);
  return json({ ...(await check(env, target.href)), quota });
}

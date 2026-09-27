import { MatrixClient } from 'matrix-js-sdk';

// Perk passes, signed by the Angaara worker (worker/perks.js). Parked until launch; see docs/PERKS.md.
export type Perk = 'animated_profile' | 'supporter' | 'early_access';
export type PerkPass = { sub: string; perks: Perk[]; exp: number };
// Your own progress, from check-in; it isn't in the published pass.
export type PerkProgress = { pass: PerkPass; days: number; unlockDays: number };

// Where every Angaara build asks for perks, so builds from the repo use the same service.
export const PERKS_API = 'https://angaara.app/api/perks';
// The `x` of the public JWK printed by scripts/perks-keygen.mjs. Empty means perks are off.
export const PERKS_PUBLIC_KEY_X = '';
// Where the pass lives in the extended profile, so other Angaara users can check it.
export const PASS_PROFILE_KEY = 'io.angaara.perks';

const PERKS: Perk[] = ['animated_profile', 'supporter', 'early_access'];
const enc = new TextEncoder();
const fromB64url = (s: string) =>
  Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));

let keyPromise: Promise<CryptoKey | undefined> | undefined;
const publicKey = () => {
  keyPromise ??= PERKS_PUBLIC_KEY_X
    ? crypto.subtle
        .importKey(
          'jwk',
          { kty: 'OKP', crv: 'Ed25519', x: PERKS_PUBLIC_KEY_X },
          { name: 'Ed25519' },
          false,
          ['verify']
        )
        .catch(() => undefined)
    : Promise.resolve(undefined);
  return keyPromise;
};

// Returns the pass only if our worker signed it, it's for this user, and it hasn't expired.
export const verifyPass = async (pass: unknown, userId: string): Promise<PerkPass | undefined> => {
  if (typeof pass !== 'string' || pass.length > 4096) return undefined;
  const parts = pass.split('.');
  if (parts.length !== 3 || parts[0] !== 'v1') return undefined;
  const key = await publicKey();
  if (!key) return undefined;
  try {
    const ok = await crypto.subtle.verify(
      { name: 'Ed25519' },
      key,
      fromB64url(parts[2]),
      enc.encode(`${parts[0]}.${parts[1]}`)
    );
    if (!ok) return undefined;
    const payload = JSON.parse(new TextDecoder().decode(fromB64url(parts[1])));
    if (payload?.aud !== 'angaara-perks' || payload.sub !== userId) return undefined;
    if (typeof payload.exp !== 'number' || payload.exp < Date.now()) return undefined;
    return {
      sub: payload.sub,
      perks: Array.isArray(payload.perks)
        ? payload.perks.filter((p: Perk) => PERKS.includes(p))
        : [],
      exp: payload.exp,
    };
  } catch {
    // Old browsers without Ed25519 just see no perks.
    return undefined;
  }
};

const perksRequest = async (mx: MatrixClient, path: string) => {
  const openId = await mx.getOpenIdToken();
  const res = await fetch(`${PERKS_API}/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      access_token: openId.access_token,
      matrix_server_name: openId.matrix_server_name,
    }),
  });
  if (!res.ok) throw new Error(`Perks request failed (${res.status})`);
  return res.json();
};

// Runs every time the app opens, so a lapsed $2/month support shows up right away.
export const perksCheckIn = async (mx: MatrixClient): Promise<PerkProgress | undefined> => {
  if (!PERKS_PUBLIC_KEY_X) return undefined;
  const userId = mx.getSafeUserId();
  const { pass, days, unlockDays } = await perksRequest(mx, 'checkin');
  const verified = await verifyPass(pass, userId);
  if (!verified) return undefined;

  // Only rewrite the profile when the perks changed or the published pass is about to expire.
  const published = await mx
    .getExtendedProfile(userId)
    .then((profile) => verifyPass(profile?.[PASS_PROFILE_KEY], userId))
    .catch(() => undefined);
  const samePerks =
    published &&
    published.perks.length === verified.perks.length &&
    published.perks.every((p) => verified.perks.includes(p));
  if (!samePerks || published.exp - Date.now() < 24 * 60 * 60 * 1000) {
    await mx.setExtendedProfileProperty(PASS_PROFILE_KEY, pass);
  }
  return {
    pass: verified,
    days: typeof days === 'number' ? days : 0,
    unlockDays: typeof unlockDays === 'number' ? unlockDays : 0,
  };
};

// A two-minute link into the early access site; the worker refuses non-supporters.
export const requestEarlyAccessLink = async (mx: MatrixClient): Promise<string> => {
  const { url } = await perksRequest(mx, 'dev-link');
  if (typeof url !== 'string' || !url.startsWith('https://')) throw new Error('Bad link');
  return url;
};

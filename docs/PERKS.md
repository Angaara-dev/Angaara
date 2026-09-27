# Perks (parked)

Earned and supporter perks, signed by the Cloudflare worker so nobody can award them to themselves. Everything is written but switched off until launch.

| Perk               | How you get it                                                       | What it does in Angaara                                                       |
| ------------------ | -------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `animated_profile` | 30 active days (`GIF_DAYS` in `worker/perks.js`)                     | GIF banners and panel backgrounds play; without it others see the first frame |
| `supporter`        | $2/month on Ko-fi (USD, EUR or GBP), 3 days' grace for late renewals | Supporter badge while supporting                                              |
| `early_access`     | Same as supporter                                                    | Entry to the early access site (dev.angaara.app)                              |

## How it stays honest

1. Every time the app opens, it asks its homeserver for an OpenID token (`mx.getOpenIdToken()`) and posts it to `/api/perks/checkin`.
2. The worker asks that homeserver who the token belongs to (`/_matrix/federation/v1/openid/userinfo`), counts at most one active day per day in KV, and returns a pass signed with Ed25519.
3. The app puts the pass in its extended profile (`io.angaara.perks`) when the perks change or the pass is about to expire. Passes last 3 days, so a lapsed supporter's badge fades even if they stop opening the app. Other Angaara apps check the signature with the public key before showing a perk.
4. Ko-fi renewals can arrive without the payment message, so the first payment links the payer's email to their Matrix ID. The email is stored only as an HMAC with a secret pepper.

GIFs can't be blocked on Matrix itself, so the gate is in what Angaara shows. Builds from the repo use the same worker and public key, so they get the same answers. The worker stores only the Matrix ID, a day counter, support dates and a hashed email for renewals.

## Turning it on

1. `node scripts/perks-keygen.mjs`
2. Worker secrets: `PERKS_SIGNING_KEY` (private JWK, type **Secret**), `PERKS_PUBLIC_KEY` (public JWK), `KOFI_VERIFICATION_TOKEN` (from Ko-fi's webhook settings), `PERKS_EMAIL_PEPPER` (any long random string, type **Secret**).
3. Create a KV namespace and bind it as `PERKS_KV` in `wrangler.jsonc`.
4. Set `PERKS_PUBLIC_KEY_X` in `src/client/perks.ts` to the public JWK's `x`, and check `PERKS_API` points at the live domain.
5. Uncomment the perks lines in `worker/index.js`.
6. Ko-fi webhook URL: `https://<domain>/api/perks/kofi`.
7. In the app:
   - Call `perksCheckIn(mx)` every time the client starts (e.g. in `ClientRoot.tsx`).
   - Use `useStillImageUrl(url, useHasPerk(userId, 'animated_profile'))` wherever banners and panel backgrounds render.
   - Add `usePerkBadges(userId)` to the badges in `UserBadges.tsx`.
   - Add a Settings button that opens `requestEarlyAccessLink(mx)`.

## Early access site

A second worker deploy of the dev branch with `DEV_GATE=1`, `DEV_ORIGIN` unset, and the same `PERKS_PUBLIC_KEY`. Its `wrangler` config needs `"run_worker_first": true` so static files are gated too. On the main worker, set `DEV_ORIGIN=https://dev.angaara.app`. Supporters get a two-minute link that sets a cookie lasting until their support period ends (30 days at most).

The code stays AGPL and public, so early access is the hosted build, not secret code.

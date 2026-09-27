# XP

Angaara counts experience in the Cloudflare Worker (`worker/xp.js`). The app sends the IDs and
send times of your own messages every few minutes, never their content. It proves who you are
with a Matrix OpenID token, so the Worker never sees your login.

- 1 XP per minute that had a message, plus 5 XP on each active day. Only rooms with someone else
  in them count, and never the XP DM.
- At most 300 XP a day (5 hours' worth of message minutes), by UTC. The first report past the limit gets a
  "touch grass" DM from the bot account, if the bot secrets below are set.
- Reports can only cover the last hour, can't repeat minutes or messages already counted, and are
  accepted at most every 30 seconds (two at once can't both get through).
- Levels at 2,000, 10,000, 30,000, 50,000 and 80,000 XP. They animate your panel background,
  then your profile banner, then unlock profile colours; 80,000 is full access
  (`worker/xp.js` and `src/client/xp.ts`). Founders have everything.
- Users can switch **Earn XP** off, or delete their XP, in Settings → Account → Experience.

## Setup

1. In the Cloudflare dashboard, go to **Storage & Databases → D1** and create a database named
   `angaara-xp`. Copy its database ID.
2. Add the binding to `wrangler.jsonc`, since deploys replace bindings made in the dashboard:

   ```jsonc
   "d1_databases": [
     { "binding": "XP_DB", "database_name": "angaara-xp", "database_id": "PASTE-ID-HERE" }
   ]
   ```

   The table is created automatically on first use.

Until `XP_DB` exists, the endpoints answer "not set up" and the app stops reporting.

## Bot account (optional)

With a bot account, the Worker checks up to 3 messages from each report and sends the daily-limit
DM. If the bot can see a reported message and it isn't the sender's, their XP is paused for 7 days
(logged as `xp: paused ...` in the Worker logs). The bot only joins a DM room that user invited it
to, and tries the DM at most 3 times a day. Add these to the Worker as type **Secret**:

- `XP_BOT_TOKEN`: the bot account's access token.
- `XP_BOT_HOMESERVER`: its homeserver URL, e.g. `https://matrix-client.matrix.org`.

Only rooms the bot has joined can be checked.

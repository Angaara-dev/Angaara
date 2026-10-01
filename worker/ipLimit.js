// Per-IP caps for steps where a self-run homeserver could mint endless Matrix IDs.
// Only a hash of the IP is kept, with a count, for the length of the window.
export const HOUR = 60 * 60 * 1000;
export const DAY = 24 * HOUR;

let tableReady;
const ensureTable = (db) => {
  tableReady ??= db
    .prepare(
      'CREATE TABLE IF NOT EXISTS ip_limit (key TEXT PRIMARY KEY, window INTEGER NOT NULL, count INTEGER NOT NULL)'
    )
    .run()
    .catch((err) => {
      tableReady = undefined;
      throw err;
    });
  return tableReady;
};

// True if this IP may do `kind` once more; counts it when allowed.
export async function takeIpLimit(env, request, kind, max, windowMs) {
  const db = env.XP_DB;
  if (!db) return true;
  await ensureTable(db);
  const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown';
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${kind}:${ip}`));
  const key = `${kind}:${btoa(String.fromCharCode(...new Uint8Array(digest))).slice(0, 22)}`;
  const now = Date.now();
  const row = await db
    .prepare('SELECT window, count FROM ip_limit WHERE key = ?')
    .bind(key)
    .first();
  const fresh = !row || now - row.window > windowMs;
  if (!fresh && row.count >= max) return false;
  await db
    .prepare(
      `INSERT INTO ip_limit (key, window, count) VALUES (?1, ?2, 1)
       ON CONFLICT(key) DO UPDATE SET
         window = CASE WHEN ?3 THEN ?2 ELSE window END,
         count = CASE WHEN ?3 THEN 1 ELSE count + 1 END`
    )
    .bind(key, now, fresh ? 1 : 0)
    .run();
  if (Math.random() < 0.01) {
    await db
      .prepare('DELETE FROM ip_limit WHERE window < ?')
      .bind(now - 7 * DAY)
      .run();
  }
  return true;
}

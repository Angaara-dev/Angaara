// Badges come from the same config.json the app loads, so there's one list for both.
export async function badgeHolders(env, url, badge) {
  try {
    const res = await env.ASSETS.fetch(new Request(new URL('/config.json', url.origin)));
    const badges = (await res.json())?.badges ?? {};
    return new Set(
      Object.entries(badges)
        .filter(([, given]) => Array.isArray(given) && given.includes(badge))
        .map(([id]) => id.toLowerCase())
    );
  } catch {
    return new Set();
  }
}

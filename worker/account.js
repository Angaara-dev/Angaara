// Deletes everything Angaara's servers keep that's tied to you, in one go.
// Crash and bug reports aren't included: they're anonymous, so nothing links them to you.
import { verifyOpenId } from './perks.js';
import { deleteXpData } from './xp.js';
import {
  angaaraUsername,
  deleteAngaaraAccount,
  deleteCheckOptions,
  verifyDeleteCheck,
} from './angaara-id.js';

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });

const localpart = (userId) => userId.slice(1).split(':')[0].toLowerCase();

export async function handleAccount(request, env, url) {
  const options = url.pathname === '/api/account/delete/options';
  if ((!options && url.pathname !== '/api/account/delete') || request.method !== 'POST') {
    return json({ error: 'not found' }, 404);
  }
  const body = await request.json().catch(() => undefined);
  const userId = await verifyOpenId(body?.openid);
  if (!userId) return json({ error: 'not signed in' }, 401);

  if (options) {
    const check = await deleteCheckOptions(env, url, userId);
    return json(check ?? { username: localpart(userId), options: null });
  }

  const username = (await angaaraUsername(env, userId)) ?? localpart(userId);
  if (
    String(body?.confirm ?? '')
      .trim()
      .replace(/^@/, '')
      .toLowerCase() !== username
  ) {
    return json({ error: "The username you typed doesn't match." }, 400);
  }
  if (!(await verifyDeleteCheck(env, url, userId, body?.passkey))) {
    return json({ error: 'Your passkey is needed to delete your Angaara account.' }, 403);
  }
  // The whole Angaara account goes, and the XP of every Matrix account linked to it.
  const everyone = await deleteAngaaraAccount(env, userId);
  await Promise.all(everyone.map((id) => deleteXpData(env, id)));
  return json({ deleted: true });
}

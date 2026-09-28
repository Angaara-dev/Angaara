// Deletes everything Angaara's servers keep that's tied to your account, in one go.
// Crash and bug reports aren't included: they're anonymous, so nothing links them to you.
import { verifyOpenId } from './perks.js';
import { deleteXpData } from './xp.js';

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });

export async function handleAccount(request, env, url) {
  if (url.pathname !== '/api/account/delete' || request.method !== 'POST') {
    return json({ error: 'not found' }, 404);
  }
  const body = await request.json().catch(() => undefined);
  const userId = await verifyOpenId(body?.openid);
  if (!userId) return json({ error: 'not signed in' }, 401);
  await deleteXpData(env, userId);
  return json({ deleted: true });
}

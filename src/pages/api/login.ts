import type { APIRoute } from 'astro';
import { createSessionCookie, passwordMatches } from '../../lib/auth';
import { json, readJsonBody, runtimeEnv } from '../../lib/menu';

export const prerender = false;

export const POST: APIRoute = async ({ locals, request }) => {
  const env = runtimeEnv(locals);
  const body = await readJsonBody(request);

  if (!passwordMatches(body.password, env)) {
    return json({ error: 'Onjuist wachtwoord' }, 401);
  }

  return json({ ok: true }, 200, {
    'Set-Cookie': await createSessionCookie(env),
  });
};

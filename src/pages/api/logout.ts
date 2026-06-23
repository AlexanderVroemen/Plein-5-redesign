import type { APIRoute } from 'astro';
import { clearSessionCookie } from '../../lib/auth';
import { json } from '../../lib/menu';

export const prerender = false;

export const POST: APIRoute = async () => {
  return json({ ok: true }, 200, {
    'Set-Cookie': clearSessionCookie(),
  });
};

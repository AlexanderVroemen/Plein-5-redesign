import type { APIRoute } from 'astro';
import { isAuthenticated } from '../../lib/auth';
import { json, runtimeEnv } from '../../lib/menu';

export const prerender = false;

export const GET: APIRoute = async ({ locals, request }) => {
  return json({ authenticated: await isAuthenticated(request, runtimeEnv(locals)) });
};

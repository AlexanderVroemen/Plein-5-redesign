import type { APIRoute } from 'astro';
import { json, readMenu, runtimeEnv } from '../../lib/menu';

export const prerender = false;

export const GET: APIRoute = async ({ locals }) => {
  return json(await readMenu(runtimeEnv(locals)));
};

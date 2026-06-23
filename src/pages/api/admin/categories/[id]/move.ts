import type { APIRoute } from 'astro';
import { requireAdmin } from '../../../../../lib/auth';
import { json, moveItem, readJsonBody, readMenu, runtimeEnv, writeMenu } from '../../../../../lib/menu';

export const prerender = false;

export const POST: APIRoute = async ({ locals, params, request }) => {
  const env = runtimeEnv(locals);
  const unauthorized = await requireAdmin(request, env);
  if (unauthorized) return unauthorized;

  const data = await readMenu(env);
  if (!data.categories.some((item) => item.id === params.id)) {
    return json({ error: 'Categorie niet gevonden' }, 404);
  }

  const body = await readJsonBody(request);
  const moved = moveItem(data.categories, String(params.id), body.direction);
  if (!moved) return json({ error: 'Categorie niet gevonden' }, 404);

  data.categories = moved;
  await writeMenu(data, env);

  return json({ ok: true });
};

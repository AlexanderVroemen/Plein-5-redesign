import type { APIRoute } from 'astro';
import { requireAdmin } from '../../../lib/auth';
import { json, normalizePrice, readJsonBody, readMenu, runtimeEnv, writeMenu } from '../../../lib/menu';

export const prerender = false;

export const PUT: APIRoute = async ({ locals, request }) => {
  const env = runtimeEnv(locals);
  const unauthorized = await requireAdmin(request, env);
  if (unauthorized) return unauthorized;

  const data = await readMenu(env);
  const body = await readJsonBody(request);

  data.monthlySpecial = {
    name: String(body.name || '').trim(),
    description: String(body.description || '').trim(),
    price: normalizePrice(body.price),
    month: String(body.month || '').trim(),
    active: body.active !== false,
    imageUrl: String(body.imageUrl || '').trim(),
  };

  await writeMenu(data, env);

  return json(data.monthlySpecial);
};

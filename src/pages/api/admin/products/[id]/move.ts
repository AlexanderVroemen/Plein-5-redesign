import type { APIRoute } from 'astro';
import { requireAdmin } from '../../../../../lib/auth';
import { json, moveItem, readJsonBody, readMenu, runtimeEnv, writeMenu } from '../../../../../lib/menu';

export const prerender = false;

export const POST: APIRoute = async ({ locals, params, request }) => {
  const env = runtimeEnv(locals);
  const unauthorized = await requireAdmin(request, env);
  if (unauthorized) return unauthorized;

  const data = await readMenu(env);
  const product = data.products.find((item) => item.id === params.id);
  if (!product) return json({ error: 'Product niet gevonden' }, 404);

  const body = await readJsonBody(request);
  const sameCategory = data.products.filter((item) => item.categoryId === product.categoryId);
  const moved = moveItem(sameCategory, product.id, body.direction);
  if (!moved) return json({ error: 'Product niet gevonden' }, 404);

  const positions = new Map(moved.map((item) => [item.id, item.position]));
  data.products = data.products.map((item) => (
    positions.has(item.id) ? { ...item, position: positions.get(item.id) || item.position } : item
  ));

  await writeMenu(data, env);

  return json({ ok: true });
};

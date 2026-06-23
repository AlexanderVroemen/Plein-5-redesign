import type { APIRoute } from 'astro';
import { requireAdmin } from '../../../../lib/auth';
import { json, readJsonBody, readMenu, runtimeEnv, slug, writeMenu } from '../../../../lib/menu';

export const prerender = false;

function randomSuffix() {
  const bytes = new Uint8Array(2);
  crypto.getRandomValues(bytes);
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export const POST: APIRoute = async ({ locals, request }) => {
  const env = runtimeEnv(locals);
  const unauthorized = await requireAdmin(request, env);
  if (unauthorized) return unauthorized;

  const data = await readMenu(env);
  const body = await readJsonBody(request);
  const name = String(body.name || '').trim();

  if (!name) return json({ error: 'Categorienaam is verplicht' }, 400);

  let id = slug(name);
  if (data.categories.some((category) => category.id === id)) id += `-${randomSuffix()}`;

  const category = {
    id,
    name,
    position: data.categories.length + 1,
  };

  data.categories.push(category);
  await writeMenu(data, env);

  return json(category, 201);
};

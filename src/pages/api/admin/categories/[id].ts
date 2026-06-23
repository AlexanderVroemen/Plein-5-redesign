import type { APIRoute } from 'astro';
import { requireAdmin } from '../../../../lib/auth';
import { json, readJsonBody, readMenu, runtimeEnv, writeMenu } from '../../../../lib/menu';

export const prerender = false;

export const PUT: APIRoute = async ({ locals, params, request }) => {
  const env = runtimeEnv(locals);
  const unauthorized = await requireAdmin(request, env);
  if (unauthorized) return unauthorized;

  const data = await readMenu(env);
  const index = data.categories.findIndex((item) => item.id === params.id);
  if (index < 0) return json({ error: 'Categorie niet gevonden' }, 404);

  const body = await readJsonBody(request);
  if (!body.name) return json({ error: 'Categorienaam is verplicht' }, 400);

  data.categories[index].name = String(body.name).trim();
  await writeMenu(data, env);

  return json(data.categories[index]);
};

export const DELETE: APIRoute = async ({ locals, params, request }) => {
  const env = runtimeEnv(locals);
  const unauthorized = await requireAdmin(request, env);
  if (unauthorized) return unauthorized;

  const data = await readMenu(env);
  const index = data.categories.findIndex((item) => item.id === params.id);
  if (index < 0) return json({ error: 'Categorie niet gevonden' }, 404);

  if (data.products.some((product) => product.categoryId === params.id)) {
    return json({ error: 'Verplaats of verwijder eerst de producten in deze categorie' }, 409);
  }

  data.categories.splice(index, 1);
  await writeMenu(data, env);

  return json({ ok: true });
};

import type { APIRoute } from 'astro';
import { requireAdmin } from '../../../../lib/auth';
import { json, normalizePrice, normalizeVariants, readJsonBody, readMenu, runtimeEnv, writeMenu } from '../../../../lib/menu';

export const prerender = false;

export const DELETE: APIRoute = async ({ locals, params, request }) => {
  const env = runtimeEnv(locals);
  const unauthorized = await requireAdmin(request, env);
  if (unauthorized) return unauthorized;

  const data = await readMenu(env);
  const index = data.products.findIndex((item) => item.id === params.id);
  if (index < 0) return json({ error: 'Product niet gevonden' }, 404);

  data.products.splice(index, 1);
  data.popularProductIds = (data.popularProductIds || []).filter((id) => id !== params.id);
  await writeMenu(data, env);

  return json({ ok: true });
};

export const PUT: APIRoute = async ({ locals, params, request }) => {
  const env = runtimeEnv(locals);
  const unauthorized = await requireAdmin(request, env);
  if (unauthorized) return unauthorized;

  const data = await readMenu(env);
  const index = data.products.findIndex((item) => item.id === params.id);
  if (index < 0) return json({ error: 'Product niet gevonden' }, 404);

  const body = await readJsonBody(request);
  const name = String(body.name || '').trim();
  const categoryId = String(body.categoryId || '');

  if (!name || !data.categories.some((category) => category.id === categoryId)) {
    return json({ error: 'Naam en categorie zijn verplicht' }, 400);
  }

  const variants = normalizeVariants(body.variants);
  data.products[index] = {
    ...data.products[index],
    name,
    price: variants.length ? variants[0].price : normalizePrice(body.price),
    categoryId,
    visible: body.visible !== false,
    ...(variants.length ? { variants } : { variants: undefined }),
  };

  if (!variants.length) delete data.products[index].variants;

  const popularIds = new Set(data.popularProductIds || []);
  if (body.popular === true) popularIds.add(data.products[index].id);
  else popularIds.delete(data.products[index].id);
  data.popularProductIds = [...popularIds].filter((id) => data.products.some((product) => product.id === id));

  await writeMenu(data, env);

  return json(data.products[index]);
};

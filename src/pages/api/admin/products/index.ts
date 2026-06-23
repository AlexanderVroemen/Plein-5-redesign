import type { APIRoute } from 'astro';
import { requireAdmin } from '../../../../lib/auth';
import { json, normalizePrice, normalizeVariants, readJsonBody, readMenu, runtimeEnv, slug, writeMenu } from '../../../../lib/menu';

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
  const categoryId = String(body.categoryId || '');

  if (!name || !data.categories.some((category) => category.id === categoryId)) {
    return json({ error: 'Naam en categorie zijn verplicht' }, 400);
  }

  const variants = normalizeVariants(body.variants);
  const product = {
    id: `${slug(name)}-${randomSuffix()}`,
    name,
    price: variants.length ? variants[0].price : normalizePrice(body.price),
    categoryId,
    position: data.products.filter((item) => item.categoryId === categoryId).length + 1,
    visible: body.visible !== false,
    ...(variants.length ? { variants } : {}),
  };

  data.products.push(product);
  if (body.popular === true) {
    data.popularProductIds = [...new Set([...(data.popularProductIds || []), product.id])];
  }
  await writeMenu(data, env);

  return json(product, 201);
};

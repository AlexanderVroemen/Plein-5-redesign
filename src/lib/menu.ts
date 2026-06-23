import defaultMenu from '../../data/menu.json';

export type MenuVariant = {
  label: string;
  price: number;
};

export type MenuProduct = {
  id: string;
  name: string;
  price: number;
  categoryId: string;
  position: number;
  visible: boolean;
  variants?: MenuVariant[];
};

export type MenuCategory = {
  id: string;
  name: string;
  position: number;
};

export type MonthlySpecial = {
  name: string;
  description: string;
  price: number;
  month: string;
  active: boolean;
  imageUrl?: string;
};

export type MenuData = {
  categories: MenuCategory[];
  products: MenuProduct[];
  monthlySpecial: MonthlySpecial;
  popularProductIds?: string[];
};

export type JsonBody = Record<string, unknown>;

const MENU_KEY = 'menu';

declare global {
  // Local/dev fallback only. Cloudflare production should use KV.
  // eslint-disable-next-line no-var
  var __PLEIN5_MENU_CACHE__: MenuData | undefined;
}

function cloneMenu(menu: MenuData): MenuData {
  return JSON.parse(JSON.stringify(menu)) as MenuData;
}

export function runtimeEnv(locals: App.Locals): Env {
  return locals.runtime?.env || {};
}

function menuKV(runtimeEnv?: Env): KVNamespace | undefined {
  return runtimeEnv?.PLEIN5_MENU;
}

export async function readMenu(runtimeEnv?: Env): Promise<MenuData> {
  const kv = menuKV(runtimeEnv);
  if (kv) {
    const saved = await kv.get<MenuData>(MENU_KEY, 'json');
    if (saved) return saved;
  }

  if (!globalThis.__PLEIN5_MENU_CACHE__) {
    globalThis.__PLEIN5_MENU_CACHE__ = cloneMenu(defaultMenu as MenuData);
  }

  return cloneMenu(globalThis.__PLEIN5_MENU_CACHE__);
}

export async function writeMenu(menu: MenuData, runtimeEnv?: Env): Promise<void> {
  const normalized = cloneMenu(menu);
  const kv = menuKV(runtimeEnv);

  if (kv) {
    await kv.put(MENU_KEY, JSON.stringify(normalized));
    return;
  }

  globalThis.__PLEIN5_MENU_CACHE__ = normalized;
}

export function json(data: unknown, status = 200, headers: HeadersInit = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...headers,
    },
  });
}

export function slug(value: string) {
  const result = String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

  return result || crypto.randomUUID();
}

export function normalizePrice(value: unknown) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) throw new Error('Ongeldige prijs');
  return Math.round(number * 100) / 100;
}

export function normalizeVariants(value: unknown): MenuVariant[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((variant) => String(variant?.label || '').trim())
    .map((variant) => ({
      label: String(variant.label).trim(),
      price: normalizePrice(variant.price),
    }));
}

export async function readJsonBody(request: Request): Promise<JsonBody> {
  const body = await request.json().catch(() => ({}));
  return body && typeof body === 'object' && !Array.isArray(body) ? body as JsonBody : {};
}

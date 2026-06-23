import { json } from './menu';

const COOKIE_NAME = 'plein5_session';
const SESSION_AGE_SECONDS = 12 * 60 * 60;
const encoder = new TextEncoder();

function adminPassword(runtimeEnv?: Env) {
  return runtimeEnv?.ADMIN_PASSWORD || 'plein5-admin';
}

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

async function sign(payload: string, runtimeEnv?: Env) {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(adminPassword(runtimeEnv)),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
  return bytesToBase64Url(new Uint8Array(signature));
}

function cookieValue(request: Request, name: string) {
  const cookie = request.headers.get('cookie') || '';
  const match = cookie.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : '';
}

export async function createSessionCookie(runtimeEnv?: Env) {
  const expires = Date.now() + SESSION_AGE_SECONDS * 1000;
  const payload = `${expires}.${crypto.randomUUID()}`;
  const signature = await sign(payload, runtimeEnv);
  return `${COOKIE_NAME}=${encodeURIComponent(`${payload}.${signature}`)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${SESSION_AGE_SECONDS}`;
}

export function clearSessionCookie() {
  return `${COOKIE_NAME}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0`;
}

export async function isAuthenticated(request: Request, runtimeEnv?: Env) {
  const value = cookieValue(request, COOKIE_NAME);
  const parts = value.split('.');
  if (parts.length !== 3) return false;

  const [expires, nonce, signature] = parts;
  if (!expires || !nonce || !signature) return false;
  if (Number(expires) < Date.now()) return false;

  const expected = await sign(`${expires}.${nonce}`, runtimeEnv);
  return expected === signature;
}

export async function requireAdmin(request: Request, runtimeEnv?: Env) {
  if (await isAuthenticated(request, runtimeEnv)) return null;
  return json({ error: 'Log opnieuw in' }, 401);
}

export function passwordMatches(candidate: unknown, runtimeEnv?: Env) {
  return String(candidate || '') === adminPassword(runtimeEnv);
}

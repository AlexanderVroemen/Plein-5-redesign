const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '127.0.0.1';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'plein5-admin';
const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, 'public');
const DATA_FILE = path.join(ROOT, 'data', 'menu.json');
const sessions = new Map();

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

function send(res, status, body, headers = {}) {
  res.writeHead(status, { 'Cache-Control': 'no-store', ...headers });
  res.end(body);
}

function sendJson(res, status, value, headers = {}) {
  send(res, status, JSON.stringify(value), { 'Content-Type': mimeTypes['.json'], ...headers });
}

function readData() {
  return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
}

function writeData(value) {
  const temporary = `${DATA_FILE}.tmp`;
  fs.writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  fs.renameSync(temporary, DATA_FILE);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', chunk => {
      raw += chunk;
      if (raw.length > 1_000_000) reject(new Error('Request too large'));
    });
    req.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        reject(new Error('Invalid JSON'));
      }
    });
    req.on('error', reject);
  });
}

function cookies(req) {
  return Object.fromEntries((req.headers.cookie || '').split(';').filter(Boolean).map(item => {
    const index = item.indexOf('=');
    return [item.slice(0, index).trim(), decodeURIComponent(item.slice(index + 1))];
  }));
}

function isAuthenticated(req) {
  const token = cookies(req).plein5_session;
  const expires = sessions.get(token);
  if (!expires || expires < Date.now()) {
    if (token) sessions.delete(token);
    return false;
  }
  return true;
}

function safePasswordMatch(candidate) {
  const expected = Buffer.from(ADMIN_PASSWORD);
  const supplied = Buffer.from(String(candidate || ''));
  return expected.length === supplied.length && crypto.timingSafeEqual(expected, supplied);
}

function slug(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '') || crypto.randomUUID();
}

function normalizePrice(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) throw new Error('Ongeldige prijs');
  return Math.round(number * 100) / 100;
}

function normalizeVariants(value) {
  if (!Array.isArray(value)) return [];
  return value
    .filter(variant => String(variant?.label || '').trim())
    .map(variant => ({
      label: String(variant.label).trim(),
      price: normalizePrice(variant.price)
    }));
}

async function handleApi(req, res, pathname) {
  if (pathname === '/api/menu' && req.method === 'GET') {
    return sendJson(res, 200, readData());
  }

  if (pathname === '/api/session' && req.method === 'GET') {
    return sendJson(res, 200, { authenticated: isAuthenticated(req) });
  }

  if (pathname === '/api/login' && req.method === 'POST') {
    const body = await readBody(req);
    if (!safePasswordMatch(body.password)) return sendJson(res, 401, { error: 'Onjuist wachtwoord' });
    const token = crypto.randomBytes(32).toString('hex');
    sessions.set(token, Date.now() + 12 * 60 * 60 * 1000);
    return sendJson(res, 200, { ok: true }, {
      'Set-Cookie': `plein5_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=43200`
    });
  }

  if (pathname === '/api/logout' && req.method === 'POST') {
    sessions.delete(cookies(req).plein5_session);
    return sendJson(res, 200, { ok: true }, {
      'Set-Cookie': 'plein5_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0'
    });
  }

  if (!pathname.startsWith('/api/admin/')) return sendJson(res, 404, { error: 'Niet gevonden' });
  if (!isAuthenticated(req)) return sendJson(res, 401, { error: 'Log opnieuw in' });

  const data = readData();
  const body = ['POST', 'PUT'].includes(req.method) ? await readBody(req) : {};

  if (pathname === '/api/admin/products' && req.method === 'POST') {
    if (!body.name || !data.categories.some(category => category.id === body.categoryId)) {
      return sendJson(res, 400, { error: 'Naam en categorie zijn verplicht' });
    }
    const variants = normalizeVariants(body.variants);
    const product = {
      id: `${slug(body.name)}-${crypto.randomBytes(2).toString('hex')}`,
      name: String(body.name).trim(),
      price: variants.length ? variants[0].price : normalizePrice(body.price),
      categoryId: body.categoryId,
      position: data.products.filter(item => item.categoryId === body.categoryId).length + 1,
      visible: body.visible !== false
    };
    if (variants.length) product.variants = variants;
    data.products.push(product);
    writeData(data);
    return sendJson(res, 201, product);
  }

  const productMatch = pathname.match(/^\/api\/admin\/products\/([^/]+)$/);
  if (productMatch) {
    const index = data.products.findIndex(item => item.id === decodeURIComponent(productMatch[1]));
    if (index < 0) return sendJson(res, 404, { error: 'Product niet gevonden' });
    if (req.method === 'DELETE') {
      data.products.splice(index, 1);
      writeData(data);
      return sendJson(res, 200, { ok: true });
    }
    if (req.method === 'PUT') {
      if (!body.name || !data.categories.some(category => category.id === body.categoryId)) {
        return sendJson(res, 400, { error: 'Naam en categorie zijn verplicht' });
      }
      const variants = normalizeVariants(body.variants);
      data.products[index] = {
        ...data.products[index],
        name: String(body.name).trim(),
        price: variants.length ? variants[0].price : normalizePrice(body.price),
        categoryId: body.categoryId,
        visible: body.visible !== false
      };
      if (variants.length) data.products[index].variants = variants;
      else delete data.products[index].variants;
      writeData(data);
      return sendJson(res, 200, data.products[index]);
    }
  }

  if (pathname === '/api/admin/categories' && req.method === 'POST') {
    if (!body.name) return sendJson(res, 400, { error: 'Categorienaam is verplicht' });
    let id = slug(body.name);
    if (data.categories.some(category => category.id === id)) id += `-${crypto.randomBytes(2).toString('hex')}`;
    const category = { id, name: String(body.name).trim(), position: data.categories.length + 1 };
    data.categories.push(category);
    writeData(data);
    return sendJson(res, 201, category);
  }

  const categoryMatch = pathname.match(/^\/api\/admin\/categories\/([^/]+)$/);
  if (categoryMatch) {
    const id = decodeURIComponent(categoryMatch[1]);
    const index = data.categories.findIndex(item => item.id === id);
    if (index < 0) return sendJson(res, 404, { error: 'Categorie niet gevonden' });
    if (req.method === 'PUT') {
      if (!body.name) return sendJson(res, 400, { error: 'Categorienaam is verplicht' });
      data.categories[index].name = String(body.name).trim();
      writeData(data);
      return sendJson(res, 200, data.categories[index]);
    }
    if (req.method === 'DELETE') {
      if (data.products.some(product => product.categoryId === id)) {
        return sendJson(res, 409, { error: 'Verplaats of verwijder eerst de producten in deze categorie' });
      }
      data.categories.splice(index, 1);
      writeData(data);
      return sendJson(res, 200, { ok: true });
    }
  }

  if (pathname === '/api/admin/monthly-special' && req.method === 'PUT') {
    data.monthlySpecial = {
      name: String(body.name || '').trim(),
      description: String(body.description || '').trim(),
      price: normalizePrice(body.price),
      month: String(body.month || '').trim(),
      active: body.active !== false
    };
    writeData(data);
    return sendJson(res, 200, data.monthlySpecial);
  }

  return sendJson(res, 404, { error: 'Niet gevonden' });
}

function serveStatic(req, res, pathname) {
  let relative = pathname === '/' ? 'index.html' : pathname.replace(/^\//, '');
  if (relative === 'admin') relative = 'admin.html';
  const filePath = path.resolve(PUBLIC_DIR, relative);
  if (!filePath.startsWith(PUBLIC_DIR)) return send(res, 403, 'Forbidden');
  fs.readFile(filePath, (error, content) => {
    if (error) {
      if (error.code === 'ENOENT') {
        const notFoundPath = path.join(PUBLIC_DIR, '404.html');
        return fs.readFile(notFoundPath, (notFoundError, notFoundContent) => {
          if (notFoundError) return send(res, 404, 'Niet gevonden', { 'Content-Type': 'text/plain; charset=utf-8' });
          send(res, 404, notFoundContent, { 'Content-Type': mimeTypes['.html'] });
        });
      }
      return send(res, 500, 'Niet gevonden', { 'Content-Type': 'text/plain; charset=utf-8' });
    }
    send(res, 200, content, { 'Content-Type': mimeTypes[path.extname(filePath)] || 'application/octet-stream', 'Cache-Control': 'public, max-age=300' });
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  try {
    if (url.pathname.startsWith('/api/')) return await handleApi(req, res, url.pathname);
    serveStatic(req, res, url.pathname);
  } catch (error) {
    console.error(error);
    sendJson(res, 400, { error: error.message || 'Er ging iets mis' });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Plein5 draait op http://${HOST}:${PORT}`);
  if (!process.env.ADMIN_PASSWORD) console.warn('Let op: gebruik voor publicatie een eigen ADMIN_PASSWORD.');
});

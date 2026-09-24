import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { HttpError, sha256 } from './util.js';
import { buildRoutes } from './routes.js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon', '.json': 'application/json', '.txt': 'text/plain; charset=utf-8', '.webmanifest': 'application/manifest+json' };
const CSP = "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'";

function headers(extra = {}) {
  return { 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'strict-origin-when-cross-origin', 'Content-Security-Policy': CSP, 'X-Frame-Options': 'DENY', 'Permissions-Policy': 'geolocation=(self), camera=(), microphone=()', ...extra };
}

export function createApp(db, { uploadDir }) {
  const routes = buildRoutes(db, { uploadDir });
  const hits = new Map();
  const limited = (ip, key, max, windowMs = 60000) => {
    if (process.env.NODE_ENV === 'test') return false;
    const k = key + ip, n = Date.now(), h = hits.get(k);
    if (!h || h.reset < n) { hits.set(k, { count: 1, reset: n + windowMs }); return false; }
    return ++h.count > max;
  };
  setInterval(() => { const n = Date.now(); for (const [k, v] of hits) if (v.reset < n) hits.delete(k); }, 60000).unref();

  const send = (res, status, body, extra = {}) => {
    const isBuf = Buffer.isBuffer(body), isStr = typeof body === 'string';
    const payload = isBuf || isStr ? body : JSON.stringify(body ?? {});
    res.writeHead(status, headers({ 'Content-Type': isBuf || isStr ? 'text/plain; charset=utf-8' : 'application/json; charset=utf-8', ...extra }));
    res.end(payload);
  };

  function readBody(req, limit) {
    return new Promise((resolve, reject) => {
      const chunks = []; let size = 0;
      req.on('data', (c) => { size += c.length; if (size > limit) { reject(new HttpError(413, 'Arquivo ou corpo grande demais.')); req.destroy(); } else chunks.push(c); });
      req.on('end', () => resolve(Buffer.concat(chunks)));
      req.on('error', reject);
    });
  }

  function session(req) {
    const m = /(?:^|;\s*)agitae_sid=([^;]+)/.exec(req.headers.cookie || '');
    if (!m) return null;
    const row = db.prepare(`SELECT u.* FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>datetime('now') AND u.deleted_at IS NULL`).get(sha256(m[1]));
    if (!row) return null;
    return { id: row.id, name: row.name, email: row.email, phone: row.phone, roles: row.roles.split(',') };
  }

  async function serveStatic(req, res, pathname) {
    let file;
    if (pathname.startsWith('/uploads/')) file = path.join(uploadDir, path.basename(pathname));
    else file = path.join(root, 'public', pathname === '/' ? 'index.html' : pathname);
    const base = pathname.startsWith('/uploads/') ? uploadDir : path.join(root, 'public');
    if (!path.resolve(file).startsWith(path.resolve(base))) return send(res, 403, 'Proibido');
    try {
      const st = fs.statSync(file);
      if (!st.isFile()) throw 0;
      const ext = path.extname(file).toLowerCase();
      res.writeHead(200, headers({ 'Content-Type': MIME[ext] || 'application/octet-stream', 'Content-Length': st.size, 'Cache-Control': pathname.startsWith('/uploads/') ? 'public, max-age=86400, immutable' : 'no-cache' }));
      fs.createReadStream(file).pipe(res);
    } catch { send(res, 404, 'Não encontrado'); }
  }

  return async function handler(req, res) {
    const started = Date.now();
    const url = new URL(req.url, 'http://x');
    const ip = req.socket.remoteAddress || '';
    let status = 500;
    try {
      if (!url.pathname.startsWith('/api/')) {
        if (url.pathname.startsWith('/img/')) { const r = routes.image(url); res.writeHead(200, headers({ 'Content-Type': 'image/svg+xml', 'Cache-Control': 'public, max-age=86400' })); res.end(r); status = 200; return; }
        if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, (status = 405), 'Método não permitido');
        status = 200; return await serveStatic(req, res, decodeURIComponent(url.pathname));
      }
      if (limited(ip, 'g', 600)) throw new HttpError(429, 'Muitas requisições. Aguarde um instante.');
      const route = routes.match(req.method, url.pathname);
      if (!route) throw new HttpError(404, 'Rota não encontrada.');
      if (route.opts.limit && limited(ip, route.opts.limit.key, route.opts.limit.max)) throw new HttpError(429, 'Muitas tentativas. Aguarde um minuto.');
      const user = session(req);
      const mutating = !['GET', 'HEAD'].includes(req.method);
      // Defesa CSRF: cookies SameSite=Lax + cabeçalho customizado exigido em toda escrita (exceto webhook assinado).
      if (mutating && !route.opts.webhook && req.headers['x-requested-with'] !== 'agitae') throw new HttpError(403, 'Requisição não permitida.');
      if (route.opts.auth && !user) throw new HttpError(401, 'Entre na sua conta para continuar.');
      if (route.opts.roles && !route.opts.roles.some((r) => user.roles.includes(r))) throw new HttpError(403, 'Você não tem permissão para isso.');
      let raw = Buffer.alloc(0), body = {};
      if (mutating) {
        raw = await readBody(req, route.opts.rawLimit || 1e6);
        if (!route.opts.binary && raw.length) { try { body = JSON.parse(raw.toString('utf8')); } catch { throw new HttpError(400, 'JSON inválido.'); } }
      }
      const ctx = { db, req, res, user, params: route.params, query: Object.fromEntries(url.searchParams), body, raw, ip, status: 200, headers: {} };
      const out = await route.handler(ctx);
      status = ctx.status;
      send(res, ctx.status, out ?? { ok: true }, ctx.headers);
    } catch (e) {
      const known = e instanceof HttpError;
      status = known ? e.status : 500;
      if (!known) console.error(JSON.stringify({ level: 'error', msg: e.message, stack: e.stack, path: url.pathname }));
      if (!res.headersSent) send(res, status, { error: known ? e.message : 'Erro interno. Tente novamente em instantes.', details: known ? e.details : undefined });
    } finally {
      if (process.env.NODE_ENV !== 'test') console.log(JSON.stringify({ level: 'info', method: req.method, path: url.pathname, status, ms: Date.now() - started }));
    }
  };
}

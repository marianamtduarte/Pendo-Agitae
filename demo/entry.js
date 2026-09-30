// Demonstração estática: roda as MESMAS rotas e regras do servidor (server/routes.js, domain.js, seed.js)
// dentro do navegador, sobre SQLite em WebAssembly (sql.js). Os dados ficam só no navegador de quem visita.
import initSqlJs from 'sql.js/dist/sql-wasm-browser.js';
import { buildRoutes } from '../server/routes.js';
import { seed } from '../server/seed.js';
import { localize } from '../server/i18n/index.js';
import { HttpError, sha256 } from '../server/util.js';
import { MIGRATIONS } from './migrations.generated.js';
import { SqlDb } from './sqldb.js';

const KEY = 'agitae.demo.db', SID = 'agitae.demo.sid', BUILD = String(__BUILD_ID__);
const $main = document.getElementById('main');
$main.innerHTML = '<p style="padding:3rem;text-align:center;font-family:system-ui">Carregando a demonstração… / Loading the demo…</p>';

const toB64 = (u8) => { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode(...u8.subarray(i, i + 0x8000)); return btoa(s); };
const fromB64 = (b) => Uint8Array.from(atob(b), (c) => c.charCodeAt(0));

const SQL = await initSqlJs({ locateFile: (f) => new URL(f, import.meta.url).href });
let db = null;
try {
  const saved = JSON.parse(localStorage.getItem(KEY) || 'null');
  if (saved && saved.build === BUILD) db = new SqlDb(SQL, fromB64(saved.data));
} catch {}
if (!db) {
  db = new SqlDb(SQL);
  db.exec('CREATE TABLE IF NOT EXISTS schema_migrations(name TEXT PRIMARY KEY)');
  for (const m of MIGRATIONS) { db.exec(m.sql); db.prepare('INSERT INTO schema_migrations(name) VALUES(?)').run(m.name); }
  seed(db);
  persistNow();
}
function persistNow() { try { localStorage.setItem(KEY, JSON.stringify({ build: BUILD, data: toB64(db.export()) })); } catch { /* cota cheia: segue só em memória */ } }
let timer; const persistSoon = () => { clearTimeout(timer); timer = setTimeout(persistNow, 400); };

const routes = buildRoutes(db, { uploadDir: '' });

function session(token) {
  if (!token) return null;
  const row = db.prepare("SELECT u.* FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>datetime('now') AND u.deleted_at IS NULL").get(sha256(token));
  return row ? { id: row.id, name: row.name, email: row.email, phone: row.phone, roles: row.roles.split(',') } : null;
}

async function handle({ method, path, body, lang }) {
  const clone = (v) => JSON.parse(JSON.stringify(v ?? {}));
  try {
    const url = new URL('/api' + path, 'http://demo');
    const route = routes.match(method, url.pathname);
    if (!route) throw new HttpError(404, 'Rota não encontrada.');
    const token = localStorage.getItem(SID), user = session(token);
    if (route.opts.auth && !user) throw new HttpError(401, 'Entre na sua conta para continuar.');
    if (route.opts.roles && !route.opts.roles.some((r) => user.roles.includes(r))) throw new HttpError(403, 'Você não tem permissão para isso.');
    if (url.pathname === '/api/uploads') throw new HttpError(400, 'Uploads não estão disponíveis na versão de demonstração online. Cole o endereço (URL) de uma imagem.');
    if (route.opts.webhook) throw new HttpError(404, 'Não encontrado.');
    const ctx = { db, req: { headers: { cookie: token ? `agitae_sid=${token}` : '' } }, res: null, user, params: route.params, query: Object.fromEntries(url.searchParams), body: clone(body), raw: null, ip: 'demo', status: 200, headers: {} };
    const out = await route.handler(ctx);
    const sc = ctx.headers['Set-Cookie'];
    if (sc) { const m = /agitae_sid=([^;]*)/.exec(sc); if (m && m[1] && !/Max-Age=0/.test(sc)) localStorage.setItem(SID, m[1]); else localStorage.removeItem(SID); }
    if (method !== 'GET') persistSoon();
    return { status: ctx.status, data: clone(localize(out ?? { ok: true }, lang)) };
  } catch (e) {
    const known = e instanceof HttpError;
    if (!known) console.error(e);
    return { status: known ? e.status : 500, data: clone(localize({ error: known ? e.message : 'Erro interno. Tente novamente em instantes.', details: known ? e.details : undefined }, lang)) };
  }
}
window.AGITAE_DEMO = handle;
window.AGITAE_DEMO_RESET = () => { try { localStorage.removeItem(KEY); localStorage.removeItem(SID); } catch {} location.reload(); };

// As imagens ilustrativas (/img/*.svg) são geradas pelo mesmo código do servidor e injetadas como data URI.
const fixImg = (img) => {
  const s = img.getAttribute('src');
  if (s && s.startsWith('/img/')) img.setAttribute('src', 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(routes.image(new URL(s, 'http://demo'))));
};
new MutationObserver((ms) => { for (const m of ms) { if (m.type === 'attributes') fixImg(m.target); else m.addedNodes.forEach((n) => { if (n.nodeType === 1) { if (n.tagName === 'IMG') fixImg(n); n.querySelectorAll && n.querySelectorAll('img').forEach(fixImg); } }); } })
  .observe(document.documentElement, { subtree: true, childList: true, attributes: true, attributeFilter: ['src'] });

const appPath = './js/app.js';
await import(appPath);

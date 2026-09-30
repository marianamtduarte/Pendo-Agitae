import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { tx } from './db.js';
import {
  HttpError, bad, str, int, date, email, oneOf, today, addDays, daysBetween, slugify, hashPassword, verifyPassword, sha256, randomToken,
  audit, notify, sendEmail, getSetting, money,
} from './util.js';
import {
  STATUS_LABEL, RESERVING, resolveLocation, availability, unavailableDates, search, providerRatings, parseImages, priceOrder, createOrder,
  orderFromProposal, startPayment, refundPolicyCents, refundOrder, processPaymentEvent, completeOrder, setStatus, addHistory, eventSummary,
} from './domain.js';
import { paymentMode, verifySignature } from './payments.js';

const EVENT_TYPES = ['aniversario', 'casamento', 'infantil', 'formatura', 'confraternizacao', 'cha', 'corporativo', 'outro'];
const parseJson = (s, d = []) => { try { return JSON.parse(s); } catch { return d; } };

export function buildRoutes(db, { uploadDir }) {
  const table = [];
  const r = (method, pattern, opts, handler) => {
    if (typeof opts === 'function') { handler = opts; opts = {}; }
    const keys = [];
    const re = new RegExp('^' + pattern.replace(/:([a-z_]+)/g, (_, k) => { keys.push(k); return '([^/]+)'; }) + '/?$');
    table.push({ method, re, keys, handler, opts });
  };
  const match = (method, p) => {
    for (const t of table) {
      if (t.method !== method) continue;
      const m = t.re.exec(p);
      if (m) return { handler: t.handler, opts: t.opts, params: Object.fromEntries(t.keys.map((k, i) => [k, decodeURIComponent(m[i + 1])])) };
    }
    return null;
  };
  const AUTH = { auth: true };
  const ADMIN = { auth: true, roles: ['admin'] };
  const PROV = { auth: true, roles: ['fornecedor'] };
  const id = (v) => { const n = Number(v); if (!Number.isInteger(n) || n < 1) throw new HttpError(404, 'Não encontrado.'); return n; };
  const get = (sql, ...p) => db.prepare(sql).get(...p);
  const all = (sql, ...p) => db.prepare(sql).all(...p);
  const run = (sql, ...p) => db.prepare(sql).run(...p);
  const myProvider = (ctx) => { const p = get('SELECT * FROM providers WHERE user_id=?', ctx.user.id); if (!p) throw new HttpError(403, 'Você ainda não tem cadastro de fornecedor.'); return p; };
  const approvedProvider = (ctx) => { const p = myProvider(ctx); if (p.status !== 'aprovado') throw new HttpError(403, 'Seu cadastro ainda não foi aprovado.'); return p; };
  const isAdmin = (u) => u.roles.includes('admin');
  const admins = () => all("SELECT id FROM users WHERE roles LIKE '%admin%' AND deleted_at IS NULL").map((u) => u.id);
  const cents = (v, name, opts) => int(v, name, { max: 1e10, ...opts });
  const dayBR = (d) => d.split('-').reverse().join('/');

  // ===================== imagens fictícias (SVG gerado) =====================
  const EMOJI = { doces: '🧁', salgados: '🥟', bolos: '🎂', buffet: '🍽️', decoracao: '🎈', fotografia: '📸', video: '🎬', dj: '🎧', espaco: '🏡', cerimonial: '💍', recreacao: '🎠', brinquedos: '🏰', lembrancinhas: '🎁', convites: '💌', flores: '💐', bebidas: '🍹', mobiliario: '🪑', iluminacao: '💡', beleza: '💄', seguranca: '🛡️', limpeza: '🧹', transporte: '🚐', pets: '🐶', capa: '🎉' };
  const HUE = { doces: 335, bolos: 20, buffet: 28, decoracao: 265, fotografia: 215, video: 235, dj: 285, espaco: 150, cerimonial: 340, recreacao: 45, brinquedos: 190, lembrancinhas: 320, convites: 200, flores: 330, bebidas: 170, mobiliario: 30, iluminacao: 50, beleza: 350, seguranca: 220, limpeza: 175, transporte: 210, pets: 25, capa: 225, logo: 225 };
  const image = (url) => {
    const name = decodeURIComponent(url.pathname.replace('/img/', '').replace(/\.svg$/, '')).slice(0, 80);
    const h = crypto.createHash('md5').update(name).digest();
    const key = Object.keys(EMOJI).find((k) => name.startsWith(k)) || 'capa';
    const base = ((HUE[key] ?? 225) + (h[0] % 24) - 12 + 360) % 360, h2 = (base + 28 + (h[1] % 30)) % 360;
    const label = (url.searchParams.get('t') || '').slice(0, 40).replace(/[<>&"']/g, '');
    const dots = Array.from({ length: 9 }, (_, i) => { const x = 40 + ((h[(i * 3) % 16] * 3 + i * 97) % 720), y = 30 + ((h[(i * 5 + 1) % 16] * 2 + i * 53) % 440), r = 4 + (h[(i + 2) % 16] % 9); return `<circle cx="${x}" cy="${y}" r="${r}" fill="hsl(${(base + i * 40) % 360} 95% 88%)" opacity=".55"/>`; }).join('');
    const logo = name.startsWith('logo');
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 500" role="img" aria-label="Imagem fictícia · Fictional image${label ? ': ' + label : ''}"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${base.toFixed(0)} 82% 60%)"/><stop offset="1" stop-color="hsl(${h2.toFixed(0)} 78% 42%)"/></linearGradient><radialGradient id="s" cx=".3" cy=".2" r=".9"><stop offset="0" stop-color="#fff" stop-opacity=".35"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient><filter id="d" x="-20%" y="-20%" width="140%" height="150%"><feDropShadow dx="0" dy="10" stdDeviation="10" flood-color="#000" flood-opacity=".25"/></filter></defs><rect width="800" height="500" fill="url(#g)"/><rect width="800" height="500" fill="url(#s)"/><circle cx="690" cy="70" r="150" fill="#fff" opacity=".10"/><circle cx="90" cy="450" r="190" fill="#fff" opacity=".09"/><path d="M0 400 C200 340 320 470 520 410 S760 360 800 390 V500 H0Z" fill="#fff" opacity=".10"/>${dots}<g filter="url(#d)"><circle cx="400" cy="${logo ? 250 : 230}" r="${logo ? 150 : 128}" fill="#fff" opacity=".93"/><text x="400" y="${logo ? 305 : 285}" font-size="${logo ? 170 : 150}" text-anchor="middle">${EMOJI[key]}</text></g>${label && !logo ? `<rect x="${400 - Math.min(340, label.length * 15 + 40)}" y="382" width="${Math.min(340, label.length * 15 + 40) * 2}" height="52" rx="26" fill="#fff" opacity=".92"/><text x="400" y="418" font-size="27" font-family="system-ui,sans-serif" font-weight="700" fill="hsl(${base.toFixed(0)} 60% 26%)" text-anchor="middle">${label}</text>` : ''}<text x="400" y="478" font-size="18" font-family="system-ui,sans-serif" fill="#fff" opacity=".8" text-anchor="middle">Imagem fictícia · Fictional image</text></svg>`;
  };

  // ===================== config / categorias / localização =====================
  const activeCategories = () => all('SELECT id,slug,name,icon,description FROM categories WHERE active=1 ORDER BY position, name');
  r('GET', '/api/config', () => ({
    categories: activeCategories(), cities: all('SELECT name,state,slug FROM cities ORDER BY name'), event_types: EVENT_TYPES,
    banners: all('SELECT id,title,text,link FROM banners WHERE active=1 ORDER BY position'), payment_mode: paymentMode(), today: today(),
  }));
  r('GET', '/api/categories', () => activeCategories());
  r('GET', '/api/locations/resolve', (ctx) => {
    const loc = resolveLocation(db, { q: ctx.query.q, lat: ctx.query.lat, lng: ctx.query.lng });
    return { location: loc && { ...loc, city: loc.city && { name: loc.city.name, state: loc.city.state, slug: loc.city.slug } } };
  });

  // ===================== busca =====================
  const money$ = (v) => (v == null || v === '' ? null : Math.round(Number(v) * 100));
  r('GET', '/api/search', (ctx) => {
    const q = ctx.query;
    const loc = resolveLocation(db, { q: q.loc, lat: q.lat, lng: q.lng });
    if (q.category && !get('SELECT 1 FROM categories WHERE slug=? AND active=1', q.category)) throw new HttpError(404, 'Categoria não encontrada.');
    const results = search(db, {
      q: q.q, category: q.category, loc, date: q.date ? date(q.date, 'data') : null, event_type: q.event_type, available: q.available === '1',
      min_price: money$(q.min_price), max_price: money$(q.max_price), min_rating: q.min_rating ? Number(q.min_rating) : 0, sort: q.sort,
    });
    if (ctx.user) { const fav = new Set(all('SELECT provider_id p FROM favorites WHERE user_id=?', ctx.user.id).map((x) => x.p)); for (const c of results) c.favorite = fav.has(c.id); }
    let empty = null, others = [];
    if (!results.length) {
      empty = loc ? (loc.kind === 'desconhecido' ? 'local_desconhecido' : 'sem_fornecedores_na_regiao') : 'sem_resultados';
      if (loc) others = search(db, { q: q.q, category: q.category, loc: null }).slice(0, 0).concat([]);
      const cities = all(`SELECT DISTINCT sa.city_slug slug, c.name, c.state FROM service_areas sa JOIN providers p ON p.id=sa.provider_id JOIN cities c ON c.slug=sa.city_slug WHERE p.status='aprovado' AND sa.type='cidade'`);
      others = cities;
    }
    return { location: loc && { ...loc, city: loc.city && { name: loc.city.name, state: loc.city.state, slug: loc.city.slug } }, total: results.length, results, empty_reason: empty, other_cities: others };
  });

  // ===================== fornecedores públicos =====================
  r('GET', '/api/providers/:slug', (ctx) => {
    const p = get('SELECT * FROM providers WHERE slug=?', ctx.params.slug);
    if (!p) throw new HttpError(404, 'Fornecedor não encontrado.');
    const owner = ctx.user && (ctx.user.id === p.user_id || isAdmin(ctx.user));
    if (p.status !== 'aprovado' && !owner) throw new HttpError(404, 'Fornecedor não encontrado.');
    if (p.status === 'aprovado' && !(ctx.user && ctx.user.id === p.user_id)) run('INSERT INTO provider_views(provider_id,day,count) VALUES(?,?,1) ON CONFLICT(provider_id,day) DO UPDATE SET count=count+1', p.id, today());
    const services = all(`SELECT s.*, c.slug cat_slug, c.name cat_name, c.icon cat_icon FROM services s JOIN categories c ON c.id=s.category_id WHERE s.provider_id=? AND s.active=1 AND s.hidden=0 AND c.active=1 ORDER BY c.position, s.featured DESC, s.name`, p.id)
      .map((s) => ({ ...s, images: parseImages(s.images), options: all('SELECT id,name,price_cents FROM service_options WHERE service_id=? AND active=1', s.id) }));
    const groups = [];
    for (const s of services) {
      let g = groups.find((x) => x.slug === s.cat_slug);
      if (!g) groups.push((g = { slug: s.cat_slug, name: s.cat_name, icon: s.cat_icon, services: [] }));
      g.services.push(s);
    }
    const rt = providerRatings(db).get(p.id) || { rating: null, review_count: 0 };
    const reviews = all(`SELECT r.id,r.rating,r.comment,r.reply,r.created_at,u.name author FROM reviews r JOIN users u ON u.id=r.user_id WHERE r.provider_id=? AND r.status='publicada' ORDER BY r.id DESC LIMIT 30`, p.id)
      .map((x) => ({ ...x, author: x.author.split(' ')[0] + ' ' + (x.author.split(' ')[1]?.[0] || '') + '.' }));
    const areas = all('SELECT * FROM service_areas WHERE provider_id=?', p.id);
    const areaText = areas.map((a) => a.type === 'cidade' ? (get('SELECT name,state FROM cities WHERE slug=?', a.city_slug) ? `${get('SELECT name FROM cities WHERE slug=?', a.city_slug).name}/${a.state}` : a.city_slug) : a.type === 'bairro' ? a.neighborhood : a.type === 'cep' ? `CEPs ${String(a.cep_from).padStart(5, '0')}–${String(a.cep_to).padStart(5, '0')}` : `raio de ${a.radius_km} km`);
    const d = ctx.query.date ? date(ctx.query.date, 'data') : null;
    return {
      provider: { id: p.id, slug: p.slug, name: p.name, description: p.description, city: p.city, state: p.state, neighborhood: p.neighborhood, address: p.address, phone: p.phone, hours: p.hours,
        cover_url: p.cover_url, logo_url: p.logo_url, verified: !!p.verified, premium: p.plan === 'premium', status: p.status, min_notice_days: p.min_notice_days, travel_fee_cents: p.travel_fee_cents, travel_policy: p.travel_policy, ...rt },
      categories: groups, media: all('SELECT id,type,url,caption FROM provider_media WHERE provider_id=? AND hidden=0 ORDER BY id', p.id), reviews, areas: areaText,
      availability: d ? availability(db, p, d) : { known: false }, favorite: ctx.user ? !!get('SELECT 1 FROM favorites WHERE user_id=? AND provider_id=?', ctx.user.id, p.id) : false,
    };
  });
  r('GET', '/api/providers/:slug/unavailable', (ctx) => {
    const p = get("SELECT * FROM providers WHERE slug=? AND status='aprovado'", ctx.params.slug);
    if (!p) throw new HttpError(404, 'Fornecedor não encontrado.');
    const from = today();
    return { dates: unavailableDates(db, p, from, addDays(from, 400)), min_notice_days: p.min_notice_days };
  });
  r('GET', '/api/services/:id', (ctx) => {
    const s = get(`SELECT s.*, c.name cat_name, c.slug cat_slug FROM services s JOIN categories c ON c.id=s.category_id JOIN providers p ON p.id=s.provider_id WHERE s.id=? AND s.active=1 AND s.hidden=0 AND p.status='aprovado'`, id(ctx.params.id));
    if (!s) throw new HttpError(404, 'Serviço não encontrado.');
    const p = get('SELECT slug,name,city,state,verified,plan FROM providers WHERE id=?', s.provider_id);
    return { ...s, images: parseImages(s.images), options: all('SELECT id,name,price_cents FROM service_options WHERE service_id=? AND active=1', s.id), provider: { ...p, verified: !!p.verified } };
  });

  // ===================== autenticação =====================
  const startSession = (ctx, userId) => {
    const token = randomToken(32);
    const days = 14;
    run("INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,datetime('now', ?))", sha256(token), userId, `+${days} days`);
    const secure = (process.env.PUBLIC_URL || '').startsWith('https') ? '; Secure' : '';
    ctx.headers['Set-Cookie'] = `agitae_sid=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${days * 86400}${secure}`;
  };
  const userView = (u) => {
    const row = get('SELECT * FROM users WHERE id=?', u.id);
    const prov = get('SELECT id,slug,name,status,plan FROM providers WHERE user_id=?', u.id);
    return { id: row.id, name: row.name, email: row.email, phone: row.phone, roles: row.roles.split(','), provider: prov || null, unread: get('SELECT COUNT(*) n FROM notifications WHERE user_id=? AND read=0', u.id).n };
  };
  r('POST', '/api/auth/register', { limit: { key: 'auth', max: 20 } }, (ctx) => {
    const b = ctx.body;
    const name = str(b.name, 'nome', { min: 2, max: 120 }), em = email(b.email);
    const pw = str(b.password, 'senha', { min: 8, max: 200 });
    if (b.consent !== true) throw bad('É necessário aceitar a Política de Privacidade para criar a conta.');
    if (get('SELECT 1 FROM users WHERE email=?', em)) throw bad('Este e-mail já está cadastrado. Tente entrar.');
    const uid = run("INSERT INTO users(name,email,password_hash,roles,phone,consent_at) VALUES(?,?,?,?,?,datetime('now'))", name, em, hashPassword(pw), 'cliente', str(b.phone, 'telefone', { optional: true, max: 30 })).lastInsertRowid;
    startSession(ctx, uid); ctx.status = 201;
    return { user: userView({ id: uid }) };
  });
  r('POST', '/api/auth/login', { limit: { key: 'auth', max: 20 } }, (ctx) => {
    const u = get('SELECT * FROM users WHERE email=? AND deleted_at IS NULL', String(ctx.body.email || '').trim().toLowerCase());
    if (!u || !verifyPassword(String(ctx.body.password || ''), u.password_hash)) throw new HttpError(401, 'E-mail ou senha incorretos.');
    startSession(ctx, u.id);
    return { user: userView(u) };
  });
  r('POST', '/api/auth/logout', (ctx) => {
    const m = /agitae_sid=([^;]+)/.exec(ctx.req.headers.cookie || '');
    if (m) run('DELETE FROM sessions WHERE token_hash=?', sha256(m[1]));
    ctx.headers['Set-Cookie'] = 'agitae_sid=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0';
    return { ok: true };
  });
  r('GET', '/api/me', (ctx) => ({ user: ctx.user ? userView(ctx.user) : null }));
  r('PATCH', '/api/me', AUTH, (ctx) => {
    const b = ctx.body;
    run('UPDATE users SET name=?, phone=? WHERE id=?', str(b.name, 'nome', { min: 2, max: 120 }), str(b.phone, 'telefone', { optional: true, max: 30 }), ctx.user.id);
    if (b.password) {
      if (!verifyPassword(String(b.current_password || ''), get('SELECT password_hash h FROM users WHERE id=?', ctx.user.id).h)) throw bad('Senha atual incorreta.');
      run('UPDATE users SET password_hash=? WHERE id=?', hashPassword(str(b.password, 'nova senha', { min: 8, max: 200 })), ctx.user.id);
    }
    return { user: userView(ctx.user) };
  });
  // LGPD: exportação e exclusão de dados
  r('GET', '/api/me/export', AUTH, (ctx) => {
    const u = ctx.user.id;
    return { exportado_em: new Date().toISOString(), usuario: get('SELECT id,name,email,phone,roles,consent_at,created_at FROM users WHERE id=?', u),
      eventos: all('SELECT * FROM events WHERE user_id=?', u), pedidos: all('SELECT * FROM orders WHERE user_id=?', u), orcamentos: all('SELECT * FROM quote_requests WHERE user_id=?', u),
      avaliacoes: all('SELECT * FROM reviews WHERE user_id=?', u), mensagens: all('SELECT * FROM messages WHERE sender_id=?', u), favoritos: all('SELECT provider_id FROM favorites WHERE user_id=?', u) };
  });
  r('POST', '/api/me/delete', AUTH, (ctx) => {
    if (!verifyPassword(String(ctx.body.password || ''), get('SELECT password_hash h FROM users WHERE id=?', ctx.user.id).h)) throw bad('Senha incorreta.');
    const open = get(`SELECT COUNT(*) n FROM orders o WHERE (o.user_id=? OR o.provider_id IN (SELECT id FROM providers WHERE user_id=?)) AND o.status IN ('aguardando_resposta','aguardando_pagamento','confirmado','em_preparacao','em_disputa')`, ctx.user.id, ctx.user.id).n;
    if (open) throw bad('Você tem pedidos em andamento. Conclua ou cancele antes de excluir a conta.');
    tx(db, () => {
      run("UPDATE users SET name='Usuário removido', email=?, phone=NULL, password_hash='x', deleted_at=datetime('now'), roles='cliente' WHERE id=?", `removido-${ctx.user.id}@removido.invalid`, ctx.user.id);
      run('DELETE FROM sessions WHERE user_id=?', ctx.user.id); run('DELETE FROM notifications WHERE user_id=?', ctx.user.id); run('DELETE FROM favorites WHERE user_id=?', ctx.user.id);
      run("UPDATE providers SET status='suspenso' WHERE user_id=?", ctx.user.id);
      run('INSERT INTO deletion_requests(user_id) VALUES(?)', ctx.user.id);
      audit(db, ctx.user.id, 'lgpd_exclusao', 'user', ctx.user.id);
    });
    ctx.headers['Set-Cookie'] = 'agitae_sid=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0';
    return { ok: true, retencao: 'Dados fiscais e financeiros de pedidos são mantidos por 5 anos (obrigação legal), sem dados pessoais identificáveis além do necessário.' };
  });

  // ===================== favoritos / notificações =====================
  r('GET', '/api/favorites', AUTH, (ctx) => all(`SELECT p.id,p.slug,p.name,p.city,p.state,p.cover_url FROM favorites f JOIN providers p ON p.id=f.provider_id WHERE f.user_id=? AND p.status='aprovado'`, ctx.user.id));
  r('POST', '/api/favorites/:id', AUTH, (ctx) => { if (!get("SELECT 1 FROM providers WHERE id=? AND status='aprovado'", id(ctx.params.id))) throw new HttpError(404, 'Fornecedor não encontrado.'); run('INSERT OR IGNORE INTO favorites VALUES(?,?)', ctx.user.id, id(ctx.params.id)); return { favorite: true }; });
  r('DELETE', '/api/favorites/:id', AUTH, (ctx) => { run('DELETE FROM favorites WHERE user_id=? AND provider_id=?', ctx.user.id, id(ctx.params.id)); return { favorite: false }; });
  r('GET', '/api/notifications', AUTH, (ctx) => all('SELECT * FROM notifications WHERE user_id=? ORDER BY id DESC LIMIT 50', ctx.user.id));
  r('POST', '/api/notifications/read', AUTH, (ctx) => { run('UPDATE notifications SET read=1 WHERE user_id=?', ctx.user.id); return { ok: true }; });

  // ===================== eventos / planejamento =====================
  const ownEvent = (ctx) => { const e = get('SELECT * FROM events WHERE id=? AND user_id=?', id(ctx.params.id), ctx.user.id); if (!e) throw new HttpError(404, 'Evento não encontrado.'); return e; };
  const eventFields = (b) => ({
    name: str(b.name, 'nome da festa', { min: 2, max: 120 }), date: date(b.date, 'data', { optional: true }), address: str(b.address, 'endereço', { optional: true, max: 250 }),
    city: str(b.city, 'cidade', { optional: true, max: 100 }), state: str(b.state, 'UF', { optional: true, max: 2 }), neighborhood: str(b.neighborhood, 'bairro', { optional: true, max: 100 }),
    type: b.type ? oneOf(b.type, EVENT_TYPES, 'tipo de festa') : null, guests: int(b.guests, 'convidados', { optional: true, max: 100000 }), budget_cents: cents(b.budget_cents, 'orçamento', { optional: true }),
  });
  r('GET', '/api/events', AUTH, (ctx) => all('SELECT * FROM events WHERE user_id=? ORDER BY COALESCE(date,\'9999\'), id DESC', ctx.user.id).map((e) => { const s = eventSummary(db, e); return { ...e, planned_cents: s.planned_cents, contracted_cents: s.contracted_cents, items: s.items.length, orders: s.orders.length }; }));
  r('POST', '/api/events', AUTH, (ctx) => {
    const f = eventFields(ctx.body);
    if (f.date && f.date < today()) throw bad('A data da festa não pode estar no passado.');
    const eid = run('INSERT INTO events(user_id,name,date,address,city,state,neighborhood,type,guests,budget_cents) VALUES(?,?,?,?,?,?,?,?,?,?)', ctx.user.id, f.name, f.date, f.address, f.city, f.state, f.neighborhood, f.type, f.guests, f.budget_cents).lastInsertRowid;
    ctx.status = 201; return get('SELECT * FROM events WHERE id=?', eid);
  });
  r('GET', '/api/events/:id', AUTH, (ctx) => {
    const e = ownEvent(ctx);
    const inv = get('SELECT * FROM invites WHERE event_id=?', e.id);
    const rsvps = inv ? all('SELECT id,name,status,companions,created_at FROM rsvps WHERE invite_id=? ORDER BY id DESC', inv.id) : [];
    return { event: e, summary: eventSummary(db, e), invite: inv, rsvps };
  });
  r('PATCH', '/api/events/:id', AUTH, (ctx) => {
    const e = ownEvent(ctx), f = eventFields({ ...e, ...ctx.body });
    run('UPDATE events SET name=?,date=?,address=?,city=?,state=?,neighborhood=?,type=?,guests=?,budget_cents=? WHERE id=?', f.name, f.date, f.address, f.city, f.state, f.neighborhood, f.type, f.guests, f.budget_cents, e.id);
    return get('SELECT * FROM events WHERE id=?', e.id);
  });
  r('DELETE', '/api/events/:id', AUTH, (ctx) => { const e = ownEvent(ctx); run('UPDATE orders SET event_id=NULL WHERE event_id=?', e.id); run('UPDATE quote_requests SET event_id=NULL WHERE event_id=?', e.id); run('DELETE FROM events WHERE id=?', e.id); return { ok: true }; });
  r('POST', '/api/events/:id/items', AUTH, (ctx) => {
    const e = ownEvent(ctx);
    const s = get("SELECT s.* FROM services s JOIN providers p ON p.id=s.provider_id WHERE s.id=? AND s.active=1 AND s.hidden=0 AND p.status='aprovado'", id(ctx.body.service_id));
    if (!s) throw bad('Serviço indisponível.');
    const qty = int(ctx.body.qty ?? s.min_qty, 'quantidade', { min: s.min_qty, max: 100000 });
    const opt = [...new Set((ctx.body.option_ids || []).map(Number))].filter((oid) => get('SELECT 1 FROM service_options WHERE id=? AND service_id=? AND active=1', oid, s.id));
    const ex = get('SELECT id FROM event_items WHERE event_id=? AND service_id=?', e.id, s.id);
    if (ex) run('UPDATE event_items SET qty=?, option_ids=? WHERE id=?', qty, JSON.stringify(opt), ex.id);
    else run('INSERT INTO event_items(event_id,service_id,qty,option_ids) VALUES(?,?,?,?)', e.id, s.id, qty, JSON.stringify(opt));
    ctx.status = 201; return { summary: eventSummary(db, e) };
  });
  r('DELETE', '/api/events/:id/items/:itemId', AUTH, (ctx) => { const e = ownEvent(ctx); run('DELETE FROM event_items WHERE id=? AND event_id=?', id(ctx.params.itemId), e.id); return { summary: eventSummary(db, e) }; });
  // convites
  r('POST', '/api/events/:id/invite', AUTH, (ctx) => {
    const e = ownEvent(ctx);
    const title = str(ctx.body.title, 'título do convite', { min: 2, max: 120 }), message = str(ctx.body.message, 'mensagem', { optional: true, max: 600 });
    const ex = get('SELECT * FROM invites WHERE event_id=?', e.id);
    if (ex) run('UPDATE invites SET title=?, message=?, active=? WHERE id=?', title, message, ctx.body.active === false ? 0 : 1, ex.id);
    else run('INSERT INTO invites(event_id,token,title,message) VALUES(?,?,?,?)', e.id, randomToken(12), title, message);
    return get('SELECT * FROM invites WHERE event_id=?', e.id);
  });
  // Acesso público de convidados: expõe SOMENTE dados do convite — nunca pedidos, valores ou pagamentos.
  r('GET', '/api/invites/:token', (ctx) => {
    const i = get('SELECT i.title,i.message,e.name,e.date,e.city,e.address,e.type FROM invites i JOIN events e ON e.id=i.event_id WHERE i.token=? AND i.active=1', ctx.params.token);
    if (!i) throw new HttpError(404, 'Convite não encontrado ou desativado.');
    return i;
  });
  r('POST', '/api/invites/:token/rsvp', { limit: { key: 'rsvp', max: 30 } }, (ctx) => {
    const i = get('SELECT id FROM invites WHERE token=? AND active=1', ctx.params.token);
    if (!i) throw new HttpError(404, 'Convite não encontrado ou desativado.');
    run('INSERT INTO rsvps(invite_id,name,status,companions) VALUES(?,?,?,?)', i.id, str(ctx.body.name, 'seu nome', { min: 2, max: 100 }), oneOf(ctx.body.status, ['vou', 'talvez', 'nao_vou'], 'resposta'), int(ctx.body.companions ?? 0, 'acompanhantes', { max: 20 }));
    ctx.status = 201; return { ok: true };
  });

  // ===================== orçamentos e propostas =====================
  const quoteFor = (ctx) => {
    const q = get('SELECT q.*, p.name provider_name, p.slug provider_slug, p.user_id provider_user, u.name customer_name, s.name service_name FROM quote_requests q JOIN providers p ON p.id=q.provider_id JOIN users u ON u.id=q.user_id LEFT JOIN services s ON s.id=q.service_id WHERE q.id=?', id(ctx.params.id));
    if (!q) throw new HttpError(404, 'Solicitação não encontrada.');
    const role = q.user_id === ctx.user.id ? 'cliente' : q.provider_user === ctx.user.id ? 'fornecedor' : isAdmin(ctx.user) ? 'admin' : null;
    if (!role) throw new HttpError(404, 'Solicitação não encontrada.');
    return { q, role };
  };
  r('POST', '/api/quotes', AUTH, (ctx) => {
    const b = ctx.body;
    const p = get("SELECT * FROM providers WHERE id=? AND status='aprovado'", id(b.provider_id));
    if (!p) throw new HttpError(404, 'Fornecedor não encontrado.');
    if (p.user_id === ctx.user.id) throw bad('Você não pode solicitar orçamento ao próprio negócio.');
    const d = date(b.date, 'data do evento');
    if (d < today()) throw bad('A data do evento não pode estar no passado.');
    const sid = b.service_id ? id(b.service_id) : null;
    if (sid && !get('SELECT 1 FROM services WHERE id=? AND provider_id=? AND active=1', sid, p.id)) throw bad('Serviço inválido para este fornecedor.');
    if (b.event_id && !get('SELECT 1 FROM events WHERE id=? AND user_id=?', id(b.event_id), ctx.user.id)) throw bad('Evento inválido.');
    const qid = run('INSERT INTO quote_requests(user_id,provider_id,service_id,event_id,date,location,city,duration,guests,notes) VALUES(?,?,?,?,?,?,?,?,?,?)',
      ctx.user.id, p.id, sid, b.event_id ?? null, d, str(b.location, 'local do evento', { max: 250 }), str(b.city, 'cidade', { optional: true, max: 100 }), str(b.duration, 'duração', { optional: true, max: 100 }),
      int(b.guests, 'convidados', { optional: true, max: 100000 }), str(b.notes, 'observações', { optional: true, max: 1500 })).lastInsertRowid;
    const av = availability(db, p, d);
    notify(db, p.user_id, 'Nova solicitação de orçamento', `${ctx.user.name} pediu um orçamento para ${dayBR(d)}${av.available === false ? ` (atenção: ${av.reason})` : ''}.`, `/fornecedor/solicitacoes/${qid}`);
    ctx.status = 201; return { id: qid, availability: av };
  });
  r('GET', '/api/quotes', AUTH, (ctx) => all(`SELECT q.*, p.name provider_name, p.slug provider_slug, s.name service_name, (SELECT COUNT(*) FROM proposals WHERE quote_id=q.id AND status='enviada') open_proposals FROM quote_requests q JOIN providers p ON p.id=q.provider_id LEFT JOIN services s ON s.id=q.service_id WHERE q.user_id=? ORDER BY q.id DESC`, ctx.user.id));
  r('GET', '/api/quotes/:id', AUTH, (ctx) => {
    const { q, role } = quoteFor(ctx);
    const proposals = all('SELECT * FROM proposals WHERE quote_id=? ORDER BY id DESC', q.id).map((p) => ({ ...p, expired: p.status === 'enviada' && p.valid_until < today() }));
    const order = get('SELECT id,status FROM orders WHERE quote_id=?', q.id);
    return { quote: { ...q, provider_user: undefined, status_label: STATUS_LABEL[q.status] || q.status }, role, proposals, order };
  });
  r('POST', '/api/quotes/:id/accept', AUTH, (ctx) => ({ order_id: orderFromProposal(db, ctx.user, id(ctx.params.id), id(ctx.body.proposal_id)) }));
  r('POST', '/api/quotes/:id/cancel', AUTH, (ctx) => {
    const { q, role } = quoteFor(ctx);
    if (role !== 'cliente') throw new HttpError(403, 'Apenas o cliente pode cancelar.');
    if (!['aguardando_resposta', 'proposta_enviada'].includes(q.status)) throw bad('Esta solicitação não pode mais ser cancelada aqui.');
    run("UPDATE quote_requests SET status='cancelado' WHERE id=?", q.id); run("UPDATE proposals SET status='recusada' WHERE quote_id=? AND status='enviada'", q.id);
    return { ok: true };
  });
  r('GET', '/api/provider/quotes', PROV, (ctx) => {
    const p = myProvider(ctx);
    return all(`SELECT q.*, u.name customer_name, s.name service_name, (SELECT COUNT(*) FROM proposals WHERE quote_id=q.id) proposals FROM quote_requests q JOIN users u ON u.id=q.user_id LEFT JOIN services s ON s.id=q.service_id WHERE q.provider_id=? ORDER BY q.id DESC`, p.id);
  });
  r('POST', '/api/provider/quotes/:id/proposal', PROV, (ctx) => {
    const p = approvedProvider(ctx), { q } = quoteFor(ctx);
    if (q.provider_id !== p.id) throw new HttpError(404, 'Solicitação não encontrada.');
    if (!['aguardando_resposta', 'proposta_enviada'].includes(q.status)) throw bad('Esta solicitação não aceita novas propostas.');
    const b = ctx.body, price = cents(b.price_cents, 'valor', { min: 1 });
    const valid = date(b.valid_until, 'validade');
    if (valid < today()) throw bad('A validade da proposta não pode estar no passado.');
    tx(db, () => {
      run("UPDATE proposals SET status='substituida' WHERE quote_id=? AND status='enviada'", q.id);
      run('INSERT INTO proposals(quote_id,provider_id,price_cents,details,conditions,valid_until) VALUES(?,?,?,?,?,?)', q.id, p.id, price, str(b.details, 'detalhes da proposta', { min: 5, max: 3000 }), str(b.conditions, 'condições', { optional: true, max: 2000 }), valid);
      run("UPDATE quote_requests SET status='proposta_enviada' WHERE id=?", q.id);
    });
    notify(db, q.user_id, 'Você recebeu uma proposta', `${p.name} enviou uma proposta de ${money(price)} válida até ${dayBR(valid)}.`, `/orcamentos/${q.id}`);
    ctx.status = 201; return { ok: true };
  });
  r('POST', '/api/provider/quotes/:id/decline', PROV, (ctx) => {
    const p = myProvider(ctx), { q } = quoteFor(ctx);
    if (q.provider_id !== p.id) throw new HttpError(404, 'Solicitação não encontrada.');
    if (!['aguardando_resposta', 'proposta_enviada'].includes(q.status)) throw bad('Não é possível recusar neste estado.');
    run("UPDATE quote_requests SET status='cancelado' WHERE id=?", q.id); run("UPDATE proposals SET status='substituida' WHERE quote_id=? AND status='enviada'", q.id);
    notify(db, q.user_id, 'Solicitação recusada', `${p.name} não poderá atender sua solicitação para ${dayBR(q.date)}. ${str(ctx.body.reason, 'motivo', { optional: true, max: 300 }) || ''}`, `/orcamentos/${q.id}`);
    return { ok: true };
  });

  // ===================== pedidos =====================
  r('POST', '/api/orders/preview', AUTH, (ctx) => {
    const b = ctx.body;
    const p = get("SELECT * FROM providers WHERE id=? AND status='aprovado'", id(b.provider_id));
    if (!p) throw new HttpError(404, 'Fornecedor não encontrado.');
    const pr = priceOrder(db, p, b.items, { city: b.city, couponCode: b.coupon });
    const d = b.event_date ? date(b.event_date, 'data') : null;
    const { commission_bps, commission_cents, net_cents, ...client } = pr; // cliente não vê comissão
    return { ...client, availability: d ? availability(db, p, d) : { known: false }, min_date: addDays(today(), pr.lead_days), policies: { cancel: 'Cancelamento com reembolso: 100% até 7 dias antes, 50% de 2 a 6 dias, sem reembolso com menos de 2 dias.' } };
  });
  r('POST', '/api/orders', AUTH, (ctx) => {
    const b = ctx.body;
    const p = get('SELECT user_id FROM providers WHERE id=?', id(b.provider_id));
    if (p?.user_id === ctx.user.id) throw bad('Você não pode contratar o próprio negócio.');
    if (b.event_id && !get('SELECT 1 FROM events WHERE id=? AND user_id=?', id(b.event_id), ctx.user.id)) throw bad('Evento inválido.');
    const oid = createOrder(db, ctx.user, { provider_id: b.provider_id, event_id: b.event_id ?? null, event_date: date(b.event_date, 'data do evento'), address: str(b.address, 'endereço do evento', { max: 250 }), city: str(b.city, 'cidade', { optional: true, max: 100 }), notes: str(b.notes, 'observações', { optional: true, max: 1500 }), items: b.items, coupon: b.coupon });
    ctx.status = 201; return { id: oid };
  });
  const orderCard = `SELECT o.*, p.name provider_name, p.slug provider_slug, u.name customer_name FROM orders o JOIN providers p ON p.id=o.provider_id JOIN users u ON u.id=o.user_id`;
  r('GET', '/api/orders', AUTH, (ctx) => all(`${orderCard} WHERE o.user_id=? ORDER BY o.id DESC`, ctx.user.id).map((o) => ({ ...o, status_label: STATUS_LABEL[o.status] })));
  r('GET', '/api/provider/orders', PROV, (ctx) => all(`${orderCard} WHERE o.provider_id=? ORDER BY o.id DESC`, myProvider(ctx).id).map(({ fee_cents, ...o }) => ({ ...o, status_label: STATUS_LABEL[o.status] })));
  const orderFor = (ctx) => {
    const o = get(`${orderCard} WHERE o.id=?`, id(ctx.params.id));
    if (!o) throw new HttpError(404, 'Pedido não encontrado.');
    const puid = get('SELECT user_id FROM providers WHERE id=?', o.provider_id).user_id;
    const role = o.user_id === ctx.user.id ? 'cliente' : puid === ctx.user.id ? 'fornecedor' : isAdmin(ctx.user) ? 'admin' : null;
    if (!role) throw new HttpError(404, 'Pedido não encontrado.');
    return { o, role, puid };
  };
  r('GET', '/api/orders/:id', AUTH, (ctx) => {
    const { o, role } = orderFor(ctx);
    const items = all('SELECT * FROM order_items WHERE order_id=?', o.id).map((i) => ({ ...i, options: parseJson(i.options) }));
    const history = all('SELECT status,note,actor,created_at FROM order_history WHERE order_id=? ORDER BY id', o.id).map((h) => ({ ...h, status_label: STATUS_LABEL[h.status] }));
    const view = { ...o, status_label: STATUS_LABEL[o.status] };
    if (role === 'cliente') { delete view.commission_bps; delete view.commission_cents; delete view.net_cents; } // comissão é informação do fornecedor/admin
    if (role === 'fornecedor') { delete view.fee_cents; }
    const payments = role === 'fornecedor' ? [] : all('SELECT id,provider,external_id,amount_cents,method,status,refunded_cents,created_at,paid_at FROM payments WHERE order_id=? ORDER BY id DESC', o.id);
    const review = get('SELECT id,rating,comment,status,reply FROM reviews WHERE order_id=?', o.id);
    const pv = get('SELECT address,phone,hours FROM providers WHERE id=?', o.provider_id);
    return { order: view, role, items, history, payments, review, refund_preview_cents: refundPolicyCents(o), payment_mode: paymentMode(), provider_contact: ['confirmado', 'em_preparacao', 'concluido'].includes(o.status) ? pv : null };
  });
  const need = (o, states, msg) => { if (!states.includes(o.status)) throw bad(msg || `Ação indisponível para pedidos "${STATUS_LABEL[o.status]}".`); };
  r('POST', '/api/orders/:id/accept', PROV, (ctx) => {
    const { o, role } = orderFor(ctx); if (role !== 'fornecedor') throw new HttpError(403, 'Apenas o fornecedor pode aceitar.');
    need(o, ['aguardando_resposta']);
    const p = get('SELECT * FROM providers WHERE id=?', o.provider_id);
    if (p.status !== 'aprovado') throw new HttpError(403, 'Cadastro não aprovado.');
    const av = availability(db, p, o.event_date);
    if (!av.available) throw new HttpError(409, `Não é possível aceitar: ${av.reason}.`);
    setStatus(db, o, 'aguardando_pagamento', 'Pedido aceito pelo fornecedor', 'fornecedor');
    notify(db, o.user_id, 'Pedido aceito — pague para confirmar', `${o.provider_name} aceitou o pedido #${o.id}. A data só é reservada após o pagamento.`, `/pedidos/${o.id}`);
    return { status: o.status };
  });
  r('POST', '/api/orders/:id/decline', PROV, (ctx) => {
    const { o, role } = orderFor(ctx); if (role !== 'fornecedor') throw new HttpError(403, 'Apenas o fornecedor pode recusar.');
    need(o, ['aguardando_resposta', 'aguardando_pagamento']);
    setStatus(db, o, 'cancelado', `Recusado pelo fornecedor: ${str(ctx.body.reason, 'motivo', { optional: true, max: 300 }) || 'sem motivo informado'}`, 'fornecedor');
    notify(db, o.user_id, 'Pedido recusado', `${o.provider_name} não poderá atender o pedido #${o.id}.`, `/pedidos/${o.id}`);
    return { status: o.status };
  });
  r('POST', '/api/orders/:id/start', PROV, (ctx) => {
    const { o, role } = orderFor(ctx); if (role !== 'fornecedor') throw new HttpError(403, 'Sem permissão.');
    need(o, ['confirmado']); setStatus(db, o, 'em_preparacao', 'Fornecedor iniciou a preparação', 'fornecedor');
    notify(db, o.user_id, 'Pedido em preparação', `${o.provider_name} começou a preparar o pedido #${o.id}.`, `/pedidos/${o.id}`);
    return { status: o.status };
  });
  r('POST', '/api/orders/:id/complete', PROV, (ctx) => {
    const { o, role } = orderFor(ctx); if (role !== 'fornecedor') throw new HttpError(403, 'Sem permissão.');
    need(o, ['confirmado', 'em_preparacao']);
    if (process.env.NODE_ENV === 'production' && o.event_date > today()) throw bad('Só é possível concluir a partir da data do evento.');
    completeOrder(db, o, 'fornecedor'); return { status: o.status };
  });
  r('POST', '/api/orders/:id/cancel', AUTH, (ctx) => {
    const { o, role } = orderFor(ctx); if (role !== 'cliente') throw new HttpError(403, 'Apenas o cliente pode cancelar o pedido.');
    need(o, ['aguardando_resposta', 'aguardando_pagamento', 'confirmado'], 'Este pedido não pode mais ser cancelado. Abra uma disputa se houver um problema.');
    tx(db, () => {
      const refund = o.status === 'confirmado' ? refundPolicyCents(o) : 0;
      setStatus(db, o, 'cancelado', `Cancelado pelo cliente. ${str(ctx.body.reason, 'motivo', { optional: true, max: 300 }) || ''}`.trim(), 'cliente');
      if (refund > 0) refundOrder(db, o, refund, 'cancelamento pelo cliente', 'sistema');
      run("UPDATE payments SET status='falhou' WHERE order_id=? AND status='pendente'", o.id);
    });
    notify(db, get('SELECT user_id FROM providers WHERE id=?', o.provider_id).user_id, 'Pedido cancelado', `O cliente cancelou o pedido #${o.id} (${dayBR(o.event_date)}).`, `/fornecedor/pedidos/${o.id}`);
    return { status: o.status };
  });
  r('POST', '/api/orders/:id/dispute', AUTH, (ctx) => {
    const { o, role, puid } = orderFor(ctx); if (role !== 'cliente') throw new HttpError(403, 'Apenas o cliente pode abrir disputa.');
    need(o, ['confirmado', 'em_preparacao', 'concluido']);
    setStatus(db, o, 'em_disputa', str(ctx.body.reason, 'motivo da disputa', { min: 10, max: 1000 }), 'cliente');
    run("UPDATE payouts SET status='pendente' WHERE order_id=? AND status='pendente'", o.id);
    for (const a of admins()) notify(db, a, 'Nova disputa', `Pedido #${o.id} em disputa.`, `/admin/pedidos`);
    notify(db, puid, 'Pedido em disputa', `O cliente abriu uma disputa no pedido #${o.id}.`, `/fornecedor/pedidos/${o.id}`);
    return { status: o.status };
  });
  r('POST', '/api/orders/:id/pay', AUTH, (ctx) => {
    const { o, role } = orderFor(ctx); if (role !== 'cliente') throw new HttpError(403, 'Apenas o cliente pode pagar.');
    const pay = startPayment(db, o);
    return { payment: { id: pay.id, external_id: pay.external_id, amount_cents: pay.amount_cents, status: pay.status }, mode: paymentMode(), test_checkout: paymentMode() === 'test' ? `/pagamento-teste/${pay.external_id}` : null };
  });
  r('POST', '/api/orders/:id/review', AUTH, (ctx) => {
    const { o, role } = orderFor(ctx); if (role !== 'cliente') throw new HttpError(403, 'Apenas o cliente pode avaliar.');
    need(o, ['concluido'], 'Só é possível avaliar contratações concluídas.');
    if (get('SELECT 1 FROM reviews WHERE order_id=?', o.id)) throw bad('Você já avaliou este pedido.');
    run('INSERT INTO reviews(order_id,provider_id,user_id,rating,comment) VALUES(?,?,?,?,?)', o.id, o.provider_id, ctx.user.id, int(ctx.body.rating, 'nota', { min: 1, max: 5 }), str(ctx.body.comment, 'comentário', { optional: true, max: 1000 }));
    for (const a of admins()) notify(db, a, 'Avaliação para moderar', `Nova avaliação do pedido #${o.id}.`, '/admin/avaliacoes');
    ctx.status = 201; return { ok: true, message: 'Avaliação enviada para moderação.' };
  });

  // ===================== pagamento (modo teste) e webhook =====================
  r('GET', '/api/pay/test/:ext', AUTH, (ctx) => {
    if (paymentMode() !== 'test') throw new HttpError(404, 'Não encontrado.');
    const pay = get('SELECT * FROM payments WHERE external_id=?', ctx.params.ext);
    const o = pay && get('SELECT o.*, p.name provider_name FROM orders o JOIN providers p ON p.id=o.provider_id WHERE o.id=?', pay.order_id);
    if (!o || o.user_id !== ctx.user.id) throw new HttpError(404, 'Pagamento não encontrado.');
    return { payment: { external_id: pay.external_id, amount_cents: pay.amount_cents, status: pay.status }, order: { id: o.id, provider_name: o.provider_name, total_cents: o.total_cents, event_date: o.event_date, status: o.status } };
  });
  r('POST', '/api/pay/test/:ext', AUTH, (ctx) => {
    if (paymentMode() !== 'test') throw new HttpError(404, 'Não encontrado.');
    const pay = get('SELECT * FROM payments WHERE external_id=?', ctx.params.ext);
    const o = pay && get('SELECT * FROM orders WHERE id=?', pay.order_id);
    if (!o || o.user_id !== ctx.user.id) throw new HttpError(404, 'Pagamento não encontrado.');
    const result = oneOf(ctx.body.result, ['approved', 'failed'], 'resultado');
    // Reproduz o que o provedor faria: um evento único, tratado pelo MESMO código do webhook real.
    const out = processPaymentEvent(db, { id: 'evt_test_' + randomToken(9), type: result === 'approved' ? 'payment.approved' : 'payment.failed', external_id: pay.external_id, amount_cents: pay.amount_cents, method: str(ctx.body.method, 'método', { optional: true, max: 20 }) });
    return { ...out, order_id: o.id };
  });
  r('POST', '/api/webhooks/payments', { webhook: true, binary: true }, (ctx) => {
    if (!verifySignature(ctx.raw, ctx.req.headers['x-agitae-signature'])) throw new HttpError(401, 'Assinatura inválida.');
    let ev; try { ev = JSON.parse(ctx.raw.toString('utf8')); } catch { throw bad('JSON inválido.'); }
    if (!ev.id || !ev.type || !ev.external_id) throw bad('Evento incompleto.');
    const out = processPaymentEvent(db, { id: String(ev.id), type: String(ev.type), external_id: String(ev.external_id), amount_cents: Number(ev.amount_cents), method: ev.method });
    if (out.divergent) throw new HttpError(422, 'Valor do pagamento diverge do pedido.');
    return out;
  });

  // ===================== mensagens =====================
  const thread = (ctx) => {
    const kind = oneOf(ctx.params.kind, ['order', 'quote'], 'tipo'), tid = id(ctx.params.id);
    const t = kind === 'order' ? get('SELECT o.user_id cu, p.user_id pu, o.id FROM orders o JOIN providers p ON p.id=o.provider_id WHERE o.id=?', tid) : get('SELECT q.user_id cu, p.user_id pu, q.id FROM quote_requests q JOIN providers p ON p.id=q.provider_id WHERE q.id=?', tid);
    if (!t || ![t.cu, t.pu].includes(ctx.user.id) && !isAdmin(ctx.user)) throw new HttpError(404, 'Conversa não encontrada.');
    return { kind, tid, t };
  };
  r('GET', '/api/threads/:kind/:id/messages', AUTH, (ctx) => {
    const { kind, tid } = thread(ctx);
    return all('SELECT m.id,m.body,m.created_at,m.sender_id,u.name sender FROM messages m JOIN users u ON u.id=m.sender_id WHERE m.thread_kind=? AND m.thread_id=? ORDER BY m.id', kind, tid).map((m) => ({ ...m, mine: m.sender_id === ctx.user.id }));
  });
  r('POST', '/api/threads/:kind/:id/messages', AUTH, (ctx) => {
    const { kind, tid, t } = thread(ctx);
    const body = str(ctx.body.body, 'mensagem', { min: 1, max: 2000 });
    run('INSERT INTO messages(thread_kind,thread_id,sender_id,body) VALUES(?,?,?,?)', kind, tid, ctx.user.id, body);
    const other = ctx.user.id === t.cu ? t.pu : t.cu;
    const link = kind === 'order' ? (other === t.cu ? `/pedidos/${tid}` : `/fornecedor/pedidos/${tid}`) : (other === t.cu ? `/orcamentos/${tid}` : `/fornecedor/solicitacoes/${tid}`);
    notify(db, other, 'Nova mensagem', `${ctx.user.name}: ${body.slice(0, 80)}`, link);
    ctx.status = 201; return { ok: true };
  });

  // ===================== uploads =====================
  const MAGIC = { 'image/jpeg': (b) => b[0] === 0xff && b[1] === 0xd8, 'image/png': (b) => b.subarray(0, 4).toString('hex') === '89504e47', 'image/webp': (b) => b.subarray(0, 4).toString() === 'RIFF' && b.subarray(8, 12).toString() === 'WEBP' };
  const EXT = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };
  r('POST', '/api/uploads', { auth: true, binary: true, rawLimit: 3e6, limit: { key: 'up', max: 30 } }, (ctx) => {
    const mime = String(ctx.req.headers['content-type'] || '').split(';')[0];
    if (!MAGIC[mime]) throw bad('Envie uma imagem JPG, PNG ou WebP.');
    if (!ctx.raw.length) throw bad('Arquivo vazio.');
    if (!MAGIC[mime](ctx.raw)) throw bad('O conteúdo do arquivo não corresponde a uma imagem válida.');
    const name = crypto.randomBytes(16).toString('hex') + EXT[mime];
    fs.writeFileSync(path.join(uploadDir, name), ctx.raw);
    run('INSERT INTO uploads(user_id,filename,mime,size) VALUES(?,?,?,?)', ctx.user.id, name, mime, ctx.raw.length);
    ctx.status = 201; return { url: `/uploads/${name}` };
  });
  const safeUrl = (u, allowExternal) => {
    u = str(u, 'endereço da mídia', { max: 500 });
    if (/^\/(uploads|img)\/[\w.\-?=%&]+$/.test(u) || (allowExternal && /^https:\/\/[^\s"'<>]+$/.test(u))) return u;
    throw bad('Endereço de mídia inválido. Envie uma imagem pela plataforma ou use um link https para vídeo.');
  };

  // ===================== fornecedor: cadastro e painel =====================
  const uniqueSlug = (name) => { let base = slugify(name) || 'fornecedor', s = base, n = 1; while (get('SELECT 1 FROM providers WHERE slug=?', s)) s = `${base}-${++n}`; return s; };
  const cityRow = (name) => get('SELECT * FROM cities WHERE slug=?', slugify(name));
  r('POST', '/api/provider/register', AUTH, (ctx) => {
    if (get('SELECT 1 FROM providers WHERE user_id=?', ctx.user.id)) throw bad('Você já possui um cadastro de fornecedor.');
    const b = ctx.body, name = str(b.name, 'nome comercial', { min: 2, max: 120 }), city = str(b.city, 'cidade', { max: 100 });
    const c = cityRow(city);
    const pid = tx(db, () => {
      const pid = run('INSERT INTO providers(user_id,slug,name,description,city,state,neighborhood,address,phone,hours,document,lat,lng,cover_url,logo_url) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
        ctx.user.id, uniqueSlug(name), name, str(b.description, 'descrição', { min: 10, max: 1500 }), c?.name || city, str(b.state, 'UF', { min: 2, max: 2 }).toUpperCase(), str(b.neighborhood, 'bairro', { optional: true, max: 100 }), str(b.address, 'endereço', { optional: true, max: 250 }),
        str(b.phone, 'telefone', { optional: true, max: 30 }), str(b.hours, 'horários', { optional: true, max: 200 }), str(b.document, 'CPF/CNPJ', { optional: true, max: 30 }), c?.lat ?? null, c?.lng ?? null, '/img/capa-' + slugify(name) + '.svg?t=' + encodeURIComponent(name.slice(0, 30)), null).lastInsertRowid;
      if (c) run("INSERT INTO service_areas(provider_id,type,city_slug,state,lat,lng) VALUES(?,?,?,?,?,?)", pid, 'cidade', c.slug, c.state, c.lat, c.lng);
      const roles = new Set(get('SELECT roles FROM users WHERE id=?', ctx.user.id).roles.split(',')); roles.add('fornecedor');
      run('UPDATE users SET roles=? WHERE id=?', [...roles].join(','), ctx.user.id);
      return pid;
    });
    for (const a of admins()) notify(db, a, 'Novo fornecedor aguardando aprovação', `${name} (${city}) enviou o cadastro.`, '/admin/fornecedores');
    ctx.status = 201; return { id: pid };
  });
  r('GET', '/api/provider/me', PROV, (ctx) => {
    const p = myProvider(ctx);
    const rt = providerRatings(db).get(p.id) || { rating: null, review_count: 0 };
    return { provider: { ...p, ...rt, document: undefined, commission_bps_effective: p.commission_bps ?? Number(getSetting(db, p.plan === 'premium' ? 'premium_commission_bps' : 'commission_bps', 750)) },
      areas: all('SELECT * FROM service_areas WHERE provider_id=?', p.id), media: all('SELECT * FROM provider_media WHERE provider_id=?', p.id),
      counts: { pending_quotes: get("SELECT COUNT(*) n FROM quote_requests WHERE provider_id=? AND status='aguardando_resposta'", p.id).n, pending_orders: get("SELECT COUNT(*) n FROM orders WHERE provider_id=? AND status='aguardando_resposta'", p.id).n } };
  });
  r('PATCH', '/api/provider/me', PROV, (ctx) => {
    const p = myProvider(ctx), b = { ...p, ...ctx.body };
    run('UPDATE providers SET name=?,description=?,city=?,state=?,neighborhood=?,address=?,phone=?,hours=?,cover_url=?,logo_url=?,min_notice_days=?,capacity_per_day=?,travel_fee_cents=?,travel_policy=? WHERE id=?',
      str(b.name, 'nome', { min: 2, max: 120 }), str(b.description, 'descrição', { min: 10, max: 1500 }), str(b.city, 'cidade', { max: 100 }), str(b.state, 'UF', { min: 2, max: 2 }).toUpperCase(), str(b.neighborhood, 'bairro', { optional: true, max: 100 }),
      str(b.address, 'endereço', { optional: true, max: 250 }), str(b.phone, 'telefone', { optional: true, max: 30 }), str(b.hours, 'horários', { optional: true, max: 200 }),
      b.cover_url ? safeUrl(b.cover_url) : null, b.logo_url ? safeUrl(b.logo_url) : null, int(b.min_notice_days, 'prazo mínimo', { max: 365 }), int(b.capacity_per_day, 'capacidade por dia', { min: 1, max: 50 }),
      cents(b.travel_fee_cents, 'taxa de deslocamento'), str(b.travel_policy, 'política de deslocamento', { optional: true, max: 500 }), p.id);
    return { ok: true };
  });
  r('PUT', '/api/provider/areas', PROV, (ctx) => {
    const p = myProvider(ctx);
    if (!Array.isArray(ctx.body.areas) || ctx.body.areas.length > 60) throw bad('Lista de áreas inválida.');
    tx(db, () => {
      run('DELETE FROM service_areas WHERE provider_id=?', p.id);
      for (const a of ctx.body.areas) {
        const type = oneOf(a.type, ['cidade', 'bairro', 'cep', 'raio'], 'tipo de área');
        if (type === 'cep') {
          const f = String(a.cep_from || '').replace(/\D/g, '').slice(0, 5), t = String(a.cep_to || a.cep_from || '').replace(/\D/g, '').slice(0, 5);
          if (f.length !== 5 || t.length !== 5 || +f > +t) throw bad('Faixa de CEP inválida (use os 5 primeiros dígitos).');
          run("INSERT INTO service_areas(provider_id,type,cep_from,cep_to) VALUES(?,?,?,?)", p.id, 'cep', +f, +t);
        } else if (type === 'raio') {
          const km = int(a.radius_km, 'raio (km)', { min: 1, max: 500 });
          if (p.lat == null) throw bad('Defina a cidade do seu negócio (cadastrada na plataforma) para usar raio.');
          run("INSERT INTO service_areas(provider_id,type,lat,lng,radius_km) VALUES(?,?,?,?,?)", p.id, 'raio', p.lat, p.lng, km);
        } else {
          const c = cityRow(str(a.city, 'cidade', { max: 100 }));
          if (!c) throw bad(`Cidade "${a.city}" ainda não é atendida pela plataforma.`);
          const nb = type === 'bairro' ? str(a.neighborhood, 'bairro', { max: 100 }) : null;
          run('INSERT INTO service_areas(provider_id,type,city_slug,state,neighborhood,neighborhood_slug,lat,lng) VALUES(?,?,?,?,?,?,?,?)', p.id, type, c.slug, c.state, nb, nb && slugify(nb), c.lat, c.lng);
        }
      }
    });
    return { areas: all('SELECT * FROM service_areas WHERE provider_id=?', p.id) };
  });
  const serviceView = (s) => ({ ...s, images: parseImages(s.images), options: all('SELECT id,name,price_cents,active FROM service_options WHERE service_id=?', s.id) });
  r('GET', '/api/provider/services', PROV, (ctx) => all('SELECT s.*, c.name cat_name FROM services s JOIN categories c ON c.id=s.category_id WHERE s.provider_id=? ORDER BY s.active DESC, c.position, s.name', myProvider(ctx).id).map(serviceView));
  const saveService = (ctx, p, existing) => {
    const b = ctx.body;
    const cat = get('SELECT id FROM categories WHERE id=? AND active=1', int(b.category_id, 'categoria', { min: 1 }));
    if (!cat) throw bad('Categoria inválida.');
    const price_type = oneOf(b.price_type, ['fechado', 'a_partir_de', 'orcamento'], 'tipo de preço');
    const price = price_type === 'orcamento' ? 0 : cents(b.price_cents, 'preço', { min: 1 });
    const images = (Array.isArray(b.images) ? b.images : []).slice(0, 8).map((u) => safeUrl(u));
    const f = [cat.id, str(b.name, 'nome do serviço', { min: 2, max: 120 }), str(b.description, 'descrição', { optional: true, max: 1500 }), price_type, price, str(b.unit, 'unidade', { max: 40 }), str(b.includes, 'o que está incluído', { optional: true, max: 1000 }),
      int(b.min_qty ?? 1, 'quantidade mínima', { min: 1, max: 100000 }), int(b.lead_days ?? 0, 'antecedência (dias)', { max: 365 }), str(b.delivery_policy, 'entrega/deslocamento', { optional: true, max: 500 }), str(b.cancel_policy, 'cancelamento', { optional: true, max: 500 }),
      Array.isArray(b.event_types) ? b.event_types.filter((t) => EVENT_TYPES.includes(t)).join(',') || null : null, JSON.stringify(images), b.featured ? 1 : 0, b.active === false ? 0 : 1];
    return tx(db, () => {
      let sid;
      if (existing) { run('UPDATE services SET category_id=?,name=?,description=?,price_type=?,price_cents=?,unit=?,includes=?,min_qty=?,lead_days=?,delivery_policy=?,cancel_policy=?,event_types=?,images=?,featured=?,active=? WHERE id=?', ...f, existing.id); sid = existing.id; }
      else sid = run('INSERT INTO services(category_id,name,description,price_type,price_cents,unit,includes,min_qty,lead_days,delivery_policy,cancel_policy,event_types,images,featured,active,provider_id) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)', ...f, p.id).lastInsertRowid;
      if (b.featured) run('UPDATE services SET featured=0 WHERE provider_id=? AND id<>?', p.id, sid);
      if (Array.isArray(b.options)) {
        run('DELETE FROM service_options WHERE service_id=?', sid);
        for (const o of b.options.slice(0, 20)) run('INSERT INTO service_options(service_id,name,price_cents) VALUES(?,?,?)', sid, str(o.name, 'nome do adicional', { max: 100 }), cents(o.price_cents, 'preço do adicional'));
      }
      return sid;
    });
  };
  r('POST', '/api/provider/services', PROV, (ctx) => { const p = myProvider(ctx); ctx.status = 201; return serviceView(get('SELECT * FROM services WHERE id=?', saveService(ctx, p))); });
  r('PATCH', '/api/provider/services/:id', PROV, (ctx) => {
    const p = myProvider(ctx), s = get('SELECT * FROM services WHERE id=? AND provider_id=?', id(ctx.params.id), p.id);
    if (!s) throw new HttpError(404, 'Serviço não encontrado.');
    ctx.body = { ...serviceView(s), ...ctx.body };
    return serviceView(get('SELECT * FROM services WHERE id=?', saveService(ctx, p, s)));
  });
  r('DELETE', '/api/provider/services/:id', PROV, (ctx) => {
    const p = myProvider(ctx), s = get('SELECT * FROM services WHERE id=? AND provider_id=?', id(ctx.params.id), p.id);
    if (!s) throw new HttpError(404, 'Serviço não encontrado.');
    if (get('SELECT 1 FROM order_items WHERE service_id=?', s.id) || get('SELECT 1 FROM quote_requests WHERE service_id=?', s.id)) { run('UPDATE services SET active=0 WHERE id=?', s.id); return { deactivated: true }; }
    run('DELETE FROM event_items WHERE service_id=?', s.id); run('DELETE FROM services WHERE id=?', s.id); return { deleted: true };
  });
  r('POST', '/api/provider/media', PROV, (ctx) => {
    const p = myProvider(ctx), type = oneOf(ctx.body.type || 'imagem', ['imagem', 'video'], 'tipo');
    const mid = run('INSERT INTO provider_media(provider_id,type,url,caption) VALUES(?,?,?,?)', p.id, type, safeUrl(ctx.body.url, type === 'video'), str(ctx.body.caption, 'legenda', { optional: true, max: 200 })).lastInsertRowid;
    ctx.status = 201; return { id: mid };
  });
  r('DELETE', '/api/provider/media/:id', PROV, (ctx) => { run('DELETE FROM provider_media WHERE id=? AND provider_id=?', id(ctx.params.id), myProvider(ctx).id); return { ok: true }; });
  r('GET', '/api/provider/agenda', PROV, (ctx) => {
    const p = myProvider(ctx), m = /^\d{4}-\d{2}$/.test(ctx.query.month || '') ? ctx.query.month : today().slice(0, 7);
    const from = m + '-01', to = m + '-31';
    return { month: m, capacity: p.capacity_per_day, blocks: all('SELECT date,reason FROM availability_blocks WHERE provider_id=? AND date BETWEEN ? AND ?', p.id, from, to),
      bookings: all(`SELECT id,event_date date,status FROM orders WHERE provider_id=? AND event_date BETWEEN ? AND ? AND status IN (${RESERVING.map(() => '?').join(',')})`, p.id, from, to, ...RESERVING) };
  });
  r('PUT', '/api/provider/blocks', PROV, (ctx) => {
    const p = myProvider(ctx), d = date(ctx.body.date, 'data');
    if (ctx.body.blocked === false) run('DELETE FROM availability_blocks WHERE provider_id=? AND date=?', p.id, d);
    else run('INSERT INTO availability_blocks(provider_id,date,reason) VALUES(?,?,?) ON CONFLICT(provider_id,date) DO UPDATE SET reason=excluded.reason', p.id, d, str(ctx.body.reason, 'motivo', { optional: true, max: 200 }));
    return { ok: true };
  });
  r('GET', '/api/provider/reviews', PROV, (ctx) => all('SELECT r.*, u.name author FROM reviews r JOIN users u ON u.id=r.user_id WHERE r.provider_id=? ORDER BY r.id DESC', myProvider(ctx).id));
  r('POST', '/api/provider/reviews/:id/reply', PROV, (ctx) => {
    const rv = get('SELECT * FROM reviews WHERE id=? AND provider_id=?', id(ctx.params.id), myProvider(ctx).id);
    if (!rv) throw new HttpError(404, 'Avaliação não encontrada.');
    run('UPDATE reviews SET reply=? WHERE id=?', str(ctx.body.reply, 'resposta', { min: 2, max: 800 }), rv.id); return { ok: true };
  });
  r('GET', '/api/provider/metrics', PROV, (ctx) => {
    const p = myProvider(ctx), to = ctx.query.to ? date(ctx.query.to, 'fim') : today(), from = ctx.query.from ? date(ctx.query.from, 'início') : addDays(to, -29);
    const paid = `status IN ('confirmado','em_preparacao','concluido')`;
    const tot = get(`SELECT COUNT(*) orders, COALESCE(SUM(total_cents),0) gross, COALESCE(SUM(commission_cents),0) commission, COALESCE(SUM(net_cents),0) net FROM orders WHERE provider_id=? AND ${paid} AND date(created_at) BETWEEN ? AND ?`, p.id, from, to);
    return { from, to, views: get('SELECT COALESCE(SUM(count),0) n FROM provider_views WHERE provider_id=? AND day BETWEEN ? AND ?', p.id, from, to).n,
      quotes: get('SELECT COUNT(*) n FROM quote_requests WHERE provider_id=? AND date(created_at) BETWEEN ? AND ?', p.id, from, to).n, requests: get('SELECT COUNT(*) n FROM orders WHERE provider_id=? AND date(created_at) BETWEEN ? AND ?', p.id, from, to).n,
      ...tot, rating: providerRatings(db).get(p.id) || null,
      series: all(`SELECT date(created_at) day, COUNT(*) orders, SUM(net_cents) net FROM orders WHERE provider_id=? AND ${paid} AND date(created_at) BETWEEN ? AND ? GROUP BY day ORDER BY day`, p.id, from, to) };
  });
  r('GET', '/api/provider/payouts', PROV, (ctx) => all('SELECT po.*, o.event_date FROM payouts po JOIN orders o ON o.id=po.order_id WHERE po.provider_id=? ORDER BY po.id DESC', myProvider(ctx).id));

  // ===================== administração =====================
  r('GET', '/api/admin/metrics', ADMIN, () => {
    const paid = `status IN ('confirmado','em_preparacao','concluido')`;
    const o = get(`SELECT COUNT(*) n, COALESCE(SUM(total_cents),0) gmv, COALESCE(SUM(commission_cents),0) commission FROM orders WHERE ${paid}`);
    const requests = get('SELECT COUNT(*) n FROM orders').n + get('SELECT COUNT(*) n FROM quote_requests WHERE id NOT IN (SELECT quote_id FROM orders WHERE quote_id IS NOT NULL)').n;
    return { active_providers: get("SELECT COUNT(*) n FROM providers WHERE status='aprovado'").n, pending_providers: get("SELECT COUNT(*) n FROM providers WHERE status='pendente'").n,
      requests, orders_paid: o.n, gmv_cents: o.gmv, commission_cents: o.commission, conversion: requests ? Math.round((o.n / requests) * 1000) / 10 : 0,
      open_disputes: get("SELECT COUNT(*) n FROM orders WHERE status='em_disputa'").n, pending_reviews: get("SELECT COUNT(*) n FROM reviews WHERE status='pendente'").n,
      top_categories: all(`SELECT c.name, COUNT(*) n FROM (SELECT category_id FROM order_items oi JOIN services s ON s.id=oi.service_id UNION ALL SELECT s.category_id FROM quote_requests q JOIN services s ON s.id=q.service_id UNION ALL SELECT s.category_id FROM event_items ei JOIN services s ON s.id=ei.service_id) x JOIN categories c ON c.id=x.category_id GROUP BY c.id ORDER BY n DESC LIMIT 6`),
      users: get('SELECT COUNT(*) n FROM users WHERE deleted_at IS NULL').n };
  });
  r('GET', '/api/admin/providers', ADMIN, (ctx) => all(`SELECT p.*, u.email owner_email, (SELECT COUNT(*) FROM services WHERE provider_id=p.id) services FROM providers p JOIN users u ON u.id=p.user_id ${ctx.query.status ? 'WHERE p.status=?' : ''} ORDER BY p.id DESC`, ...(ctx.query.status ? [ctx.query.status] : [])));
  r('POST', '/api/admin/providers/:id', ADMIN, (ctx) => {
    const p = get('SELECT * FROM providers WHERE id=?', id(ctx.params.id));
    if (!p) throw new HttpError(404, 'Fornecedor não encontrado.');
    const b = ctx.body, changes = {};
    if (b.status) { changes.status = oneOf(b.status, ['pendente', 'aprovado', 'suspenso', 'rejeitado'], 'status'); run('UPDATE providers SET status=? WHERE id=?', changes.status, p.id); }
    if (b.verified !== undefined) { changes.verified = b.verified ? 1 : 0; run('UPDATE providers SET verified=? WHERE id=?', changes.verified, p.id); }
    if (b.plan) { changes.plan = oneOf(b.plan, ['basico', 'premium'], 'plano'); run('UPDATE providers SET plan=? WHERE id=?', changes.plan, p.id); }
    if (b.commission_bps !== undefined) { changes.commission_bps = b.commission_bps === null || b.commission_bps === '' ? null : int(b.commission_bps, 'comissão (bps)', { max: 5000 }); run('UPDATE providers SET commission_bps=? WHERE id=?', changes.commission_bps, p.id); }
    audit(db, ctx.user.id, 'fornecedor_atualizado', 'provider', p.id, { ...changes, nome: p.name });
    if (changes.status === 'aprovado') notify(db, p.user_id, 'Cadastro aprovado! 🎉', 'Seu perfil já está publicado na Agitaê.', '/fornecedor');
    if (changes.status === 'suspenso' || changes.status === 'rejeitado') notify(db, p.user_id, 'Cadastro ' + (changes.status === 'suspenso' ? 'suspenso' : 'não aprovado'), 'Entre em contato com o suporte para mais informações.', '/fornecedor');
    return get('SELECT * FROM providers WHERE id=?', p.id);
  });
  r('GET', '/api/admin/services', ADMIN, () => all('SELECT s.id,s.name,s.price_type,s.price_cents,s.hidden,s.active,s.images,p.name provider_name,c.name cat_name FROM services s JOIN providers p ON p.id=s.provider_id JOIN categories c ON c.id=s.category_id ORDER BY s.id DESC LIMIT 200').map((s) => ({ ...s, images: parseImages(s.images) })));
  r('POST', '/api/admin/services/:id/hide', ADMIN, (ctx) => { run('UPDATE services SET hidden=? WHERE id=?', ctx.body.hidden ? 1 : 0, id(ctx.params.id)); audit(db, ctx.user.id, ctx.body.hidden ? 'servico_ocultado' : 'servico_liberado', 'service', id(ctx.params.id)); return { ok: true }; });
  r('GET', '/api/admin/media', ADMIN, () => all('SELECT m.*, p.name provider_name FROM provider_media m JOIN providers p ON p.id=m.provider_id ORDER BY m.id DESC LIMIT 100'));
  r('POST', '/api/admin/media/:id/hide', ADMIN, (ctx) => { run('UPDATE provider_media SET hidden=? WHERE id=?', ctx.body.hidden ? 1 : 0, id(ctx.params.id)); audit(db, ctx.user.id, 'midia_moderada', 'media', id(ctx.params.id), { hidden: !!ctx.body.hidden }); return { ok: true }; });
  r('GET', '/api/admin/reviews', ADMIN, (ctx) => all(`SELECT r.*, u.name author, p.name provider_name FROM reviews r JOIN users u ON u.id=r.user_id JOIN providers p ON p.id=r.provider_id ${ctx.query.status ? 'WHERE r.status=?' : ''} ORDER BY r.id DESC LIMIT 100`, ...(ctx.query.status ? [ctx.query.status] : [])));
  r('POST', '/api/admin/reviews/:id', ADMIN, (ctx) => { const st = oneOf(ctx.body.status, ['publicada', 'rejeitada'], 'status'); run('UPDATE reviews SET status=? WHERE id=?', st, id(ctx.params.id)); audit(db, ctx.user.id, 'avaliacao_' + st, 'review', id(ctx.params.id)); return { ok: true }; });
  r('GET', '/api/admin/users', ADMIN, () => all('SELECT id,name,email,roles,created_at,deleted_at FROM users ORDER BY id DESC LIMIT 300'));
  r('POST', '/api/admin/users/:id', ADMIN, (ctx) => {
    const roles = [...new Set((ctx.body.roles || []).filter((x) => ['cliente', 'fornecedor', 'admin'].includes(x)))];
    if (!roles.includes('cliente')) roles.unshift('cliente');
    if (id(ctx.params.id) === ctx.user.id && !roles.includes('admin')) throw bad('Você não pode remover seu próprio acesso de administrador.');
    run('UPDATE users SET roles=? WHERE id=?', roles.join(','), id(ctx.params.id)); audit(db, ctx.user.id, 'papeis_alterados', 'user', id(ctx.params.id), { roles }); return { ok: true };
  });
  r('GET', '/api/admin/orders', ADMIN, (ctx) => all(`${orderCard} ${ctx.query.status ? 'WHERE o.status=?' : ''} ORDER BY o.id DESC LIMIT 200`, ...(ctx.query.status ? [ctx.query.status] : [])).map((o) => ({ ...o, status_label: STATUS_LABEL[o.status] })));
  r('POST', '/api/admin/orders/:id/resolve', ADMIN, (ctx) => {
    const o = get('SELECT * FROM orders WHERE id=?', id(ctx.params.id));
    if (!o || o.status !== 'em_disputa') throw bad('Este pedido não está em disputa.');
    const res = oneOf(ctx.body.resolution, ['reembolsar', 'liberar'], 'decisão'), note = str(ctx.body.note, 'justificativa', { min: 3, max: 500 });
    tx(db, () => {
      if (res === 'reembolsar') { refundOrder(db, o, o.total_cents - o.refunded_cents, 'disputa resolvida a favor do cliente', 'admin'); run("UPDATE payouts SET status='cancelado' WHERE order_id=? AND status='pendente'", o.id); setStatus(db, o, 'cancelado', `Disputa: reembolso integral. ${note}`, 'admin'); }
      else { setStatus(db, o, 'concluido', `Disputa: liberado ao fornecedor. ${note}`, 'admin'); run('INSERT OR IGNORE INTO payouts(provider_id,order_id,amount_cents) VALUES(?,?,?)', o.provider_id, o.id, o.net_cents); }
      audit(db, ctx.user.id, 'disputa_resolvida', 'order', o.id, { res, note });
    });
    notify(db, o.user_id, 'Disputa resolvida', `Pedido #${o.id}: ${res === 'reembolsar' ? 'reembolso aprovado' : 'liberado ao fornecedor'}.`, `/pedidos/${o.id}`);
    notify(db, get('SELECT user_id FROM providers WHERE id=?', o.provider_id).user_id, 'Disputa resolvida', `Pedido #${o.id} foi ${res === 'reembolsar' ? 'reembolsado ao cliente' : 'liberado para repasse'}.`, `/fornecedor/pedidos/${o.id}`);
    return { status: get('SELECT status FROM orders WHERE id=?', o.id).status };
  });
  r('POST', '/api/admin/orders/:id/refund', ADMIN, (ctx) => {
    const o = get('SELECT * FROM orders WHERE id=?', id(ctx.params.id)); if (!o) throw new HttpError(404, 'Pedido não encontrado.');
    const amount = cents(ctx.body.amount_cents, 'valor', { min: 1 });
    const done = refundOrder(db, o, amount, str(ctx.body.reason, 'motivo', { min: 3, max: 300 }), 'admin');
    if (!done) throw bad('Nada a reembolsar neste pedido.');
    audit(db, ctx.user.id, 'reembolso', 'order', o.id, { amount: done }); return { refunded_cents: done };
  });
  r('GET', '/api/admin/categories', ADMIN, () => all('SELECT * FROM categories ORDER BY position, name'));
  r('POST', '/api/admin/categories', ADMIN, (ctx) => {
    const name = str(ctx.body.name, 'nome', { min: 2, max: 60 }), slug = slugify(ctx.body.slug || name);
    if (get('SELECT 1 FROM categories WHERE slug=?', slug)) throw bad('Já existe uma categoria com este identificador.');
    const cid = run('INSERT INTO categories(slug,name,icon,description,position) VALUES(?,?,?,?,?)', slug, name, str(ctx.body.icon, 'ícone', { optional: true, max: 8 }) || '🎉', str(ctx.body.description, 'descrição', { optional: true, max: 200 }), int(ctx.body.position ?? 99, 'posição', { max: 999 })).lastInsertRowid;
    audit(db, ctx.user.id, 'categoria_criada', 'category', cid, { name }); ctx.status = 201; return { id: cid };
  });
  r('PATCH', '/api/admin/categories/:id', ADMIN, (ctx) => {
    const c = get('SELECT * FROM categories WHERE id=?', id(ctx.params.id)); if (!c) throw new HttpError(404, 'Categoria não encontrada.');
    const b = { ...c, ...ctx.body };
    run('UPDATE categories SET name=?,icon=?,description=?,position=?,active=? WHERE id=?', str(b.name, 'nome', { min: 2, max: 60 }), str(b.icon, 'ícone', { max: 8 }), str(b.description, 'descrição', { optional: true, max: 200 }), int(b.position, 'posição', { max: 999 }), b.active ? 1 : 0, c.id);
    audit(db, ctx.user.id, 'categoria_editada', 'category', c.id, ctx.body); return { ok: true };
  });
  r('GET', '/api/admin/coupons', ADMIN, () => all('SELECT * FROM coupons ORDER BY id DESC'));
  r('POST', '/api/admin/coupons', ADMIN, (ctx) => {
    const b = ctx.body, kind = oneOf(b.kind, ['percentual', 'fixo'], 'tipo'), value = int(b.value, 'valor', { min: 1, max: kind === 'percentual' ? 100 : 1e7 });
    const code = str(b.code, 'código', { min: 3, max: 30 }).toUpperCase().replace(/[^A-Z0-9_-]/g, '');
    if (get('SELECT 1 FROM coupons WHERE code=?', code)) throw bad('Código já existe.');
    const cid = run('INSERT INTO coupons(code,kind,value,expires_at,max_uses) VALUES(?,?,?,?,?)', code, kind, value, date(b.expires_at, 'validade', { optional: true }), int(b.max_uses, 'limite de usos', { optional: true, min: 1 })).lastInsertRowid;
    audit(db, ctx.user.id, 'cupom_criado', 'coupon', cid, { code }); ctx.status = 201; return { id: cid };
  });
  r('PATCH', '/api/admin/coupons/:id', ADMIN, (ctx) => { run('UPDATE coupons SET active=? WHERE id=?', ctx.body.active ? 1 : 0, id(ctx.params.id)); audit(db, ctx.user.id, 'cupom_alterado', 'coupon', id(ctx.params.id), ctx.body); return { ok: true }; });
  r('GET', '/api/admin/banners', ADMIN, () => all('SELECT * FROM banners ORDER BY position, id'));
  r('POST', '/api/admin/banners', ADMIN, (ctx) => {
    const b = ctx.body, bid = run('INSERT INTO banners(title,text,link) VALUES(?,?,?)', str(b.title, 'título', { min: 2, max: 100 }), str(b.text, 'texto', { optional: true, max: 200 }), str(b.link, 'link', { optional: true, max: 200 })).lastInsertRowid;
    audit(db, ctx.user.id, 'banner_criado', 'banner', bid); ctx.status = 201; return { id: bid };
  });
  r('PATCH', '/api/admin/banners/:id', ADMIN, (ctx) => { run('UPDATE banners SET active=? WHERE id=?', ctx.body.active ? 1 : 0, id(ctx.params.id)); audit(db, ctx.user.id, 'banner_alterado', 'banner', id(ctx.params.id), ctx.body); return { ok: true }; });
  r('DELETE', '/api/admin/banners/:id', ADMIN, (ctx) => { run('DELETE FROM banners WHERE id=?', id(ctx.params.id)); audit(db, ctx.user.id, 'banner_removido', 'banner', id(ctx.params.id)); return { ok: true }; });
  r('GET', '/api/admin/settings', ADMIN, () => ({ commission_bps: Number(getSetting(db, 'commission_bps', 750)), premium_commission_bps: Number(getSetting(db, 'premium_commission_bps', 700)), customer_fee_bps: Number(getSetting(db, 'customer_fee_bps', 0)), payment_mode: paymentMode() }));
  r('PUT', '/api/admin/settings', ADMIN, (ctx) => {
    const b = ctx.body, out = {};
    for (const k of ['commission_bps', 'premium_commission_bps', 'customer_fee_bps']) if (b[k] !== undefined) { out[k] = int(b[k], k, { max: 5000 }); run('INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value', k, String(out[k])); }
    audit(db, ctx.user.id, 'configuracao_alterada', 'settings', null, out); return { ok: true, changed: out };
  });
  r('GET', '/api/admin/payments', ADMIN, () => ({
    payments: all('SELECT pay.*, o.total_cents order_total FROM payments pay JOIN orders o ON o.id=pay.order_id ORDER BY pay.id DESC LIMIT 200'),
    payouts: all('SELECT po.*, p.name provider_name FROM payouts po JOIN providers p ON p.id=po.provider_id ORDER BY po.id DESC LIMIT 200'),
  }));
  r('POST', '/api/admin/payouts/:id/pay', ADMIN, (ctx) => {
    if (paymentMode() === 'live') throw new HttpError(503, 'Repasses reais dependem da integração com o provedor (veja docs/PAYMENTS.md).');
    const po = get('SELECT po.*, o.status ostatus FROM payouts po JOIN orders o ON o.id=po.order_id WHERE po.id=?', id(ctx.params.id));
    if (!po || po.status !== 'pendente') throw bad('Repasse indisponível.');
    if (po.ostatus !== 'concluido') throw bad('O repasse só é liberado após a conclusão do pedido (e sem disputa).');
    run("UPDATE payouts SET status='pago', paid_at=datetime('now') WHERE id=?", po.id); audit(db, ctx.user.id, 'repasse_pago_teste', 'payout', po.id);
    notify(db, get('SELECT user_id FROM providers WHERE id=?', po.provider_id).user_id, 'Repasse realizado', `${money(po.amount_cents)} referente ao pedido #${po.order_id} (modo teste).`, '/fornecedor/financeiro');
    return { ok: true };
  });
  r('GET', '/api/admin/audit', ADMIN, () => all('SELECT a.*, u.name actor FROM audit_log a LEFT JOIN users u ON u.id=a.actor_id ORDER BY a.id DESC LIMIT 200'));
  r('GET', '/api/admin/emails', ADMIN, () => all('SELECT * FROM emails ORDER BY id DESC LIMIT 50'));

  r('GET', '/api/health', () => ({ ok: true, time: new Date().toISOString() }));
  return { match, image };
}

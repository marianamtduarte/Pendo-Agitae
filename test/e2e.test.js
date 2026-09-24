import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';

process.env.NODE_ENV = 'test';
process.env.PAYMENT_MODE = 'test';
process.env.PAYMENT_WEBHOOK_SECRET = 'segredo-de-teste';
const { openDb } = await import('../server/db.js');
const { createApp } = await import('../server/app.js');
const { seed, DEMO_PASSWORD } = await import('../server/seed.js');
const { addDays, today } = await import('../server/util.js');

let server, base, db;
const uploadDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agitae-up-'));

class Client {
  constructor() { this.cookie = ''; }
  async req(method, url, body, headers = {}) {
    const res = await fetch(base + url, { method, headers: { 'X-Requested-With': 'agitae', ...(body && !(body instanceof Buffer) ? { 'Content-Type': 'application/json' } : {}), cookie: this.cookie, ...headers }, body: body instanceof Buffer ? body : body ? JSON.stringify(body) : undefined });
    const sc = res.headers.get('set-cookie'); if (sc) this.cookie = sc.split(';')[0];
    const text = await res.text(); let json; try { json = JSON.parse(text); } catch { json = text; }
    return { status: res.status, body: json };
  }
  get(u) { return this.req('GET', u); }
  post(u, b = {}) { return this.req('POST', u, b); }
  async ok(method, u, b) { const r = await this.req(method, u, b); assert.ok(r.status < 300, `${method} ${u} → ${r.status} ${JSON.stringify(r.body)}`); return r.body; }
  async login(email) { await this.ok('POST', '/api/auth/login', { email, password: DEMO_PASSWORD }); return this; }
}
const as = (email) => new Client().login(email);

before(async () => {
  db = openDb(':memory:'); seed(db);
  server = http.createServer(createApp(db, { uploadDir }));
  await new Promise((r) => server.listen(0, r));
  base = `http://localhost:${server.address().port}`;
});
after(() => { server.close(); });

const D30 = () => addDays(today(), 30), D45 = () => addDays(today(), 40);

test('Jornada 1 — doces e salgados por localidade, perfil e catálogo completo', async () => {
  const v = new Client();
  const s = await v.ok('GET', '/api/search?category=doces-salgados&loc=Mooca');
  const names = s.results.map((r) => r.name);
  assert.ok(names.includes('Salgadinhos da Vovó') && names.includes('Doce Sabor Confeitaria'));
  assert.ok(!names.includes('Bolos & Afetos'), 'não atende Mooca');
  const p = await v.ok('GET', '/api/providers/doce-sabor-confeitaria');
  const cats = p.categories.map((c) => c.slug);
  assert.deepEqual(cats.sort(), ['bolos', 'doces-salgados', 'lembrancinhas'].sort(), 'perfil mostra itens de outras categorias');
  const brig = p.categories.flatMap((c) => c.services).find((x) => x.name.startsWith('Brigadeiro'));
  assert.equal(brig.price_cents, 18000); assert.ok(brig.options.length === 2 && brig.includes && brig.lead_days === 3);
  const none = await v.ok('GET', '/api/search?category=doces-salgados&loc=Campinas');
  assert.equal(none.total, 0); assert.equal(none.empty_reason, 'sem_fornecedores_na_regiao');
  const geo = await v.ok('GET', '/api/search?category=fotografia&lat=-22.9&lng=-43.2');
  assert.ok(geo.results.some((r) => r.name === 'Clara Mendes Fotografia'));
  assert.equal((await v.ok('GET', '/api/search?category=fotografia&loc=zzzz')).empty_reason, 'local_desconhecido');
});

test('Jornada 2 — comparar fotógrafos por data e solicitar orçamento', async () => {
  const ana = await as('cliente@agitae.test');
  const all = await ana.ok('GET', `/api/search?category=fotografia&loc=São Paulo&date=${D30()}`);
  assert.equal(all.results.find((r) => r.name === 'Luz e Cor Fotografia').availability.available, false);
  const only = await ana.ok('GET', `/api/search?category=fotografia&loc=São Paulo&date=${D30()}&available=1`);
  assert.equal(only.total, 0, 'único fotógrafo de SP está ocupado nessa data');
  const rio = await ana.ok('GET', `/api/search?category=fotografia&loc=Rio de Janeiro&date=${D30()}&available=1&sort=preco_asc`);
  assert.equal(rio.results[0].name, 'Clara Mendes Fotografia');
  const clara = await ana.ok('GET', '/api/providers/clara-mendes-fotografia');
  const q = await ana.ok('POST', '/api/quotes', { provider_id: clara.provider.id, date: D30(), location: 'Salão Aurora, Botafogo', city: 'Rio de Janeiro', duration: '5 horas', guests: 80, notes: 'Casamento civil' });
  assert.ok(q.id && q.availability.available);
  assert.equal((await ana.req('POST', '/api/quotes', { provider_id: clara.provider.id, date: '2020-01-01', location: 'x' })).status, 400);
});

test('Jornada 3 — criar festa, itens de fornecedores diferentes e total planejado', async () => {
  const ana = await as('cliente@agitae.test');
  const ev = await ana.ok('POST', '/api/events', { name: 'Aniversário da Bia', date: D45(), city: 'São Paulo', state: 'SP', type: 'aniversario', guests: 40, budget_cents: 300000 });
  const bol = (await ana.ok('GET', '/api/providers/doce-sabor-confeitaria')).categories.flatMap((c) => c.services).find((s) => s.name.startsWith('Bolo decorado'));
  const dec = (await ana.ok('GET', '/api/providers/decora-festa')).categories.flatMap((c) => c.services).find((s) => s.name.startsWith('Arco'));
  const cer = (await ana.ok('GET', '/api/providers/cerimonial-encanto')).categories.flatMap((c) => c.services).find((s) => s.price_type === 'orcamento');
  await ana.ok('POST', `/api/events/${ev.id}/items`, { service_id: bol.id, qty: 3, option_ids: [bol.options[0].id] });
  await ana.ok('POST', `/api/events/${ev.id}/items`, { service_id: dec.id, qty: 1 });
  await ana.ok('POST', `/api/events/${ev.id}/items`, { service_id: cer.id, qty: 1 });
  const e = await ana.ok('GET', `/api/events/${ev.id}`);
  assert.equal(e.summary.planned_cents, 11000 * 3 + 3000 + 38000);
  assert.equal(e.summary.quote_pending, 1);
  assert.equal(new Set(e.summary.items.map((i) => i.provider_id)).size, 3);
  assert.equal((await ana.req('POST', `/api/events/${ev.id}/items`, { service_id: bol.id, qty: 1 })).status, 400, 'quantidade mínima');
  // outro usuário não vê o evento
  assert.equal((await (await as('bruno@agitae.test')).get(`/api/events/${ev.id}`)).status, 404);
  // convite: público não expõe pedidos
  const inv = await ana.ok('POST', `/api/events/${ev.id}/invite`, { title: 'Parabéns da Bia', message: 'Venha!' });
  const guest = new Client();
  const pub = await guest.ok('GET', `/api/invites/${inv.token}`);
  assert.equal(pub.title, 'Parabéns da Bia'); assert.equal(pub.orders, undefined);
  await guest.ok('POST', `/api/invites/${inv.token}/rsvp`, { name: 'Tia Rita', status: 'vou', companions: 1 });
  assert.equal((await ana.get(`/api/events/${ev.id}`)).body.rsvps.length, 1);
  // contratar do planejamento: preço calculado só no servidor
  const prov = (await ana.ok('GET', '/api/providers/decora-festa')).provider;
  const prev = await ana.ok('POST', '/api/orders/preview', { provider_id: prov.id, items: [{ service_id: dec.id, qty: 2, unit_cents: 1 }], city: 'São Paulo', coupon: 'FESTA50' });
  assert.equal(prev.total_cents, 76000 - 5000); assert.equal(prev.commission_cents, undefined);
});

test('Jornadas 4 e 6 — proposta do fornecedor, aceite, pagamento em modo teste e estados do pedido', async () => {
  const ana = await as('cliente@agitae.test'), clara = await as('clara-mendes-fotografia@agitae.test');
  const cp = (await ana.ok('GET', '/api/providers/clara-mendes-fotografia')).provider;
  const { id: qid } = await ana.ok('POST', '/api/quotes', { provider_id: cp.id, date: D30(), location: 'Buffet Central, Niterói', city: 'Niterói', duration: '6h', guests: 100 });
  const inbox = await clara.ok('GET', '/api/provider/quotes');
  assert.ok(inbox.some((q) => q.id === qid && q.status === 'aguardando_resposta'));
  await clara.ok('POST', `/api/provider/quotes/${qid}/proposal`, { price_cents: 150000, details: '6h de cobertura, 300 fotos', conditions: 'Sinal via plataforma', valid_until: addDays(today(), 7) });
  assert.equal((await clara.req('POST', `/api/provider/quotes/${qid}/proposal`, { price_cents: 100, details: 'x', valid_until: '2020-01-01' })).status, 400);
  const q = await ana.ok('GET', `/api/quotes/${qid}`);
  assert.equal(q.quote.status, 'proposta_enviada'); const pid = q.proposals[0].id;
  const { order_id } = await ana.ok('POST', `/api/quotes/${qid}/accept`, { proposal_id: pid });
  let o = await ana.ok('GET', `/api/orders/${order_id}`);
  assert.equal(o.order.status, 'aguardando_pagamento'); assert.equal(o.order.travel_cents, 6000); assert.equal(o.order.total_cents, 156000);
  assert.equal(o.order.commission_cents, undefined, 'cliente não vê comissão');
  const po = await clara.ok('GET', `/api/orders/${order_id}`);
  assert.equal(po.order.commission_cents, Math.round(156000 * 0.075)); assert.equal(po.order.net_cents, 156000 - po.order.commission_cents);
  // pagamento: idempotente, aprovado só por evento do provedor
  const p1 = await ana.ok('POST', `/api/orders/${order_id}/pay`), p2 = await ana.ok('POST', `/api/orders/${order_id}/pay`);
  assert.equal(p1.payment.external_id, p2.payment.external_id);
  assert.equal((await clara.req('POST', `/api/pay/test/${p1.payment.external_id}`, { result: 'approved' })).status, 404, 'só o dono paga');
  const paid = await ana.ok('POST', `/api/pay/test/${p1.payment.external_id}`, { result: 'approved', method: 'pix' });
  assert.equal(paid.status, 'confirmado');
  await clara.ok('POST', `/api/orders/${order_id}/start`);
  await clara.ok('POST', `/api/orders/${order_id}/complete`);
  o = await ana.ok('GET', `/api/orders/${order_id}`);
  assert.deepEqual(o.history.map((h) => h.status), ['solicitado', 'proposta_enviada', 'aguardando_pagamento', 'confirmado', 'em_preparacao', 'concluido']);
  // mensagens e avaliação
  await ana.ok('POST', `/api/threads/order/${order_id}/messages`, { body: 'Obrigada!' });
  assert.equal((await clara.get(`/api/threads/order/${order_id}/messages`)).body.length, 1);
  assert.equal((await (await as('bruno@agitae.test')).get(`/api/threads/order/${order_id}/messages`)).status, 404);
  await ana.ok('POST', `/api/orders/${order_id}/review`, { rating: 5, comment: 'Lindo trabalho' });
  assert.equal((await ana.req('POST', `/api/orders/${order_id}/review`, { rating: 5 })).status, 400);
  const admin = await as('admin@agitae.test');
  const rv = (await admin.ok('GET', '/api/admin/reviews?status=pendente'))[0];
  await admin.ok('POST', `/api/admin/reviews/${rv.id}`, { status: 'publicada' });
  const payout = (await admin.ok('GET', '/api/admin/payments')).payouts.find((x) => x.order_id === order_id);
  assert.equal(payout.status, 'pendente'); await admin.ok('POST', `/api/admin/payouts/${payout.id}/pay`);
  const notif = await ana.ok('GET', '/api/notifications'); assert.ok(notif.length > 0);
});

test('Jornada 5 — admin aprova fornecedor pendente e acompanha pedido', async () => {
  const v = new Client();
  assert.equal((await v.get('/api/providers/festas-do-ze-brinquedos')).status, 404, 'pendente não é público');
  assert.equal((await v.get('/api/search?category=brinquedos&loc=Campinas')).body.total, 0);
  // novo cadastro completo
  const nova = await new Client().ok('POST', '/api/auth/register', { name: 'Marta Dias', email: 'marta@teste.com', password: 'senha12345', consent: true });
  assert.ok(nova.user);
  const admin = await as('admin@agitae.test');
  assert.equal((await (await as('cliente@agitae.test')).get('/api/admin/metrics')).status, 403);
  assert.equal((await new Client().get('/api/admin/metrics')).status, 401);
  const list = await admin.ok('GET', '/api/admin/providers?status=pendente');
  const ze = list.find((p) => p.slug === 'festas-do-ze-brinquedos');
  await admin.ok('POST', `/api/admin/providers/${ze.id}`, { status: 'aprovado' });
  assert.equal((await v.get('/api/search?category=brinquedos&loc=Campinas')).body.total, 1);
  const orders = await admin.ok('GET', '/api/admin/orders'); assert.ok(orders.length > 0);
  const audit = await admin.ok('GET', '/api/admin/audit'); assert.ok(audit.some((a) => a.action === 'fornecedor_atualizado'));
  const m = await admin.ok('GET', '/api/admin/metrics'); assert.ok(m.active_providers >= 18 && m.gmv_cents > 0);
  await admin.ok('PUT', '/api/admin/settings', { commission_bps: 800 });
  assert.equal((await admin.get('/api/admin/settings')).body.commission_bps, 800);
  await admin.ok('PUT', '/api/admin/settings', { commission_bps: 750 });
});

test('Proteção contra reserva duplicada, webhook assinado e idempotência', async () => {
  const bruno = await as('bruno@agitae.test'), carla = await as('carla@agitae.test'), iris = await as('estudio-iris@agitae.test');
  const ip = (await bruno.ok('GET', '/api/providers/estudio-iris')).provider;
  const svc = (await bruno.ok('GET', '/api/providers/estudio-iris')).categories[0].services.find((s) => s.name.includes('2 horas'));
  const date = addDays(today(), 60);
  const mk = async (c, city) => (await c.ok('POST', '/api/orders', { provider_id: ip.id, event_date: date, address: 'Rua A, 1', city, items: [{ service_id: svc.id, qty: 1 }] })).id;
  const a = await mk(bruno, 'Curitiba'), b = await mk(carla, 'Curitiba'); // disponibilidade é informativa até o pagamento
  for (const id of [a, b]) await iris.ok('POST', `/api/orders/${id}/accept`);
  const pa = (await bruno.ok('POST', `/api/orders/${a}/pay`)).payment, pb = (await carla.ok('POST', `/api/orders/${b}/pay`)).payment;
  assert.equal((await bruno.ok('POST', `/api/pay/test/${pa.external_id}`, { result: 'approved' })).status, 'confirmado');
  const second = await carla.ok('POST', `/api/pay/test/${pb.external_id}`, { result: 'approved' });
  assert.equal(second.status, 'estornado_por_indisponibilidade');
  const ob = await carla.ok('GET', `/api/orders/${b}`);
  assert.equal(ob.order.status, 'cancelado'); assert.equal(ob.order.refunded_cents, ob.order.total_cents);
  assert.equal((await carla.req('POST', '/api/orders', { provider_id: ip.id, event_date: date, address: 'x', city: 'Curitiba', items: [{ service_id: svc.id, qty: 1 }] })).status, 409, 'agora está lotada');
  // webhook: assinatura obrigatória, idempotência por id do evento, valor conferido
  const c = await as('carla@agitae.test');
  const d2 = addDays(today(), 70);
  const o3 = (await c.ok('POST', '/api/orders', { provider_id: ip.id, event_date: d2, address: 'Rua B', city: 'Curitiba', items: [{ service_id: svc.id, qty: 1 }] })).id;
  await iris.ok('POST', `/api/orders/${o3}/accept`);
  const pay = (await c.ok('POST', `/api/orders/${o3}/pay`)).payment;
  const send = (body, sig) => fetch(base + '/api/webhooks/payments', { method: 'POST', headers: { 'x-agitae-signature': sig }, body });
  const sign = (b) => crypto.createHmac('sha256', 'segredo-de-teste').update(b).digest('hex');
  const bad = JSON.stringify({ id: 'evt_1', type: 'payment.approved', external_id: pay.external_id, amount_cents: pay.amount_cents });
  assert.equal((await send(bad, 'assinatura-falsa')).status, 401);
  const wrongAmount = JSON.stringify({ id: 'evt_x', type: 'payment.approved', external_id: pay.external_id, amount_cents: 1 });
  assert.equal((await send(wrongAmount, sign(wrongAmount))).status, 422);
  assert.equal((await c.get(`/api/orders/${o3}`)).body.order.status, 'aguardando_pagamento', 'valor divergente não confirma');
  const pay2 = (await c.ok('POST', `/api/orders/${o3}/pay`)).payment;
  assert.notEqual(pay2.external_id, pay.external_id, 'tentativa anterior falhou → nova cobrança');
  const good = JSON.stringify({ id: 'evt_2', type: 'payment.approved', external_id: pay2.external_id, amount_cents: pay2.amount_cents });
  assert.equal((await send(good, sign(good))).status, 200);
  const dup = await (await send(good, sign(good))).json(); assert.equal(dup.duplicate, true);
  assert.equal((await c.get(`/api/orders/${o3}`)).body.order.status, 'confirmado');
  // cancelamento com reembolso conforme política (>7 dias = 100%)
  const cn = await c.ok('POST', `/api/orders/${o3}/cancel`, { reason: 'Mudança de planos' });
  assert.equal(cn.status, 'cancelado'); assert.equal((await c.get(`/api/orders/${o3}`)).body.order.refunded_cents, pay2.amount_cents);
});

test('Segurança: CSRF, upload, permissões, LGPD e modo live sem credenciais', async () => {
  const ana = await as('cliente@agitae.test');
  assert.equal((await fetch(base + '/api/auth/logout', { method: 'POST', headers: { cookie: ana.cookie } })).status, 403, 'sem cabeçalho anti-CSRF');
  assert.equal((await ana.req('POST', '/api/uploads', Buffer.from('<?php echo 1; ?>'), { 'Content-Type': 'image/png' })).status, 400, 'conteúdo não é PNG');
  const png = Buffer.concat([Buffer.from('89504e470d0a1a0a', 'hex'), Buffer.alloc(64)]);
  const up = await ana.req('POST', '/api/uploads', png, { 'Content-Type': 'image/png' }); assert.equal(up.status, 201);
  assert.equal((await fetch(base + up.body.url)).status, 200);
  assert.equal((await new Client().req('POST', '/api/auth/register', { name: 'X Y', email: 'x@y.com', password: '12345678' })).status, 400, 'consentimento obrigatório');
  assert.equal((await new Client().req('POST', '/api/auth/login', { email: 'cliente@agitae.test', password: 'errada' })).status, 401);
  const bruno = await as('bruno@agitae.test');
  assert.equal((await bruno.get('/api/provider/me')).status, 403);
  const exp = await ana.ok('GET', '/api/me/export'); assert.equal(exp.usuario.email, 'cliente@agitae.test');
  const { paymentMode } = await import('../server/payments.js');
  process.env.PAYMENT_MODE = 'live';
  try {
    const ev = (await ana.ok('POST', '/api/events', { name: 'Teste live' }));
    const doce = (await ana.ok('GET', '/api/providers/doce-sabor-confeitaria'));
    const s = doce.categories[0].services[0];
    const oid = (await ana.ok('POST', '/api/orders', { provider_id: doce.provider.id, event_date: addDays(today(), 25), address: 'Rua', city: 'São Paulo', items: [{ service_id: s.id, qty: 1 }] })).id;
    await (await as('doce-sabor-confeitaria@agitae.test')).ok('POST', `/api/orders/${oid}/accept`);
    const r = await ana.req('POST', `/api/orders/${oid}/pay`); assert.equal(r.status, 503); assert.match(r.body.error, /PAYMENT_PROVIDER/);
    assert.equal(paymentMode(), 'live');
  } finally { process.env.PAYMENT_MODE = 'test'; }
});

test('Idiomas: PT/EN traduzem dados do catálogo, mensagens de erro e notificações', async () => {
  const v = new Client();
  const pt = await v.ok('GET', '/api/providers/doce-sabor-confeitaria');
  const en = await fetch(base + '/api/providers/doce-sabor-confeitaria', { headers: { 'X-Lang': 'en' } }).then((r) => r.json());
  assert.equal(pt.categories[0].name, 'Doces e salgados');
  assert.equal(en.categories[0].name, 'Sweets & savory snacks');
  assert.match(en.provider.description, /Artisanal confectionery/);
  // erros com valores dinâmicos
  const r = await fetch(base + '/api/orders/preview', { method: 'POST', headers: { 'X-Requested-With': 'agitae', 'X-Lang': 'en', 'Content-Type': 'application/json', cookie: (await as('cliente@agitae.test')).cookie }, body: JSON.stringify({ provider_id: pt.provider.id, items: [{ service_id: pt.categories.flatMap((c) => c.services).find((x) => x.name.startsWith('Bolo decorado')).id, qty: 1 }] }) });
  const body = await r.json();
  assert.equal(r.status, 400); assert.match(body.error, /Minimum quantity for "Decorated cake \(per kg\)": 2\./);
  // texto digitado por usuário não é alterado; idioma desconhecido cai para PT
  const ana = await as('cliente@agitae.test');
  const ev = await ana.ok('POST', '/api/events', { name: 'Festa da Bia' });
  const list = await fetch(base + '/api/events', { headers: { cookie: ana.cookie, 'X-Lang': 'en' } }).then((x) => x.json());
  assert.ok(list.some((e) => e.name === 'Festa da Bia' && e.id === ev.id));
  const xx = await fetch(base + '/api/categories', { headers: { 'X-Lang': 'fr' } }).then((x) => x.json());
  assert.equal(xx[0].name, 'Doces e salgados');
  const notifs = await fetch(base + '/api/notifications', { headers: { cookie: ana.cookie, 'X-Lang': 'en' } }).then((x) => x.json());
  assert.ok(notifs.every((n) => !/Pedido|Pagamento aprovado/.test(n.title)), 'títulos das notificações traduzidos: ' + notifs.map((n) => n.title).join('|'));
});

test('Cobertura de tradução: interface e catálogo de demonstração não têm textos sem inglês', async () => {
  const { execFileSync } = await import('node:child_process');
  execFileSync(process.execPath, ['scripts/extract-i18n.js'], { stdio: 'pipe' }); // falha (exit 1) se faltar alguma chave t('…') em public/js/en.js
  const { tr } = await import('../server/i18n/index.js');
  const same = new Set(['100 mini pizzas', 'van', 'Lindo trabalho', 'Buffet', 'Naked cake', 'kit', 'combo', 'show', 'kg', 'Bolo decorado (por kg)']);
  const missing = [];
  const check = (s) => { if (s && !same.has(s) && tr(s, 'en') === s) missing.push(s); };
  for (const c of db.prepare('SELECT name FROM categories').all()) check(c.name);
  for (const p of db.prepare('SELECT description, hours, travel_policy FROM providers').all()) { check(p.description); check(p.hours); check(p.travel_policy); }
  for (const s of db.prepare('SELECT name, description, includes, unit, delivery_policy, cancel_policy FROM services').all()) { check(s.name); check(s.description); check(s.includes); check(s.unit); check(s.delivery_policy); check(s.cancel_policy); }
  for (const o of db.prepare('SELECT name FROM service_options').all()) check(o.name);
  for (const r of db.prepare('SELECT comment, reply FROM reviews').all()) { check(r.comment); check(r.reply); }
  for (const b of db.prepare('SELECT title, text FROM banners').all()) { check(b.title); check(b.text); }
  assert.deepEqual([...new Set(missing)].slice(0, 10), [], 'textos do seed sem tradução');
});

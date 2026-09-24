import { tx } from './db.js';
import { HttpError, bad, today, addDays, daysBetween, slugify, haversine, notify, audit, getSetting, money } from './util.js';
import { createCharge, refundCharge } from './payments.js';

export const RESERVING = ['confirmado', 'em_preparacao', 'concluido']; // estados que ocupam a agenda
export const STATUS_LABEL = {
  solicitado: 'Solicitado', aguardando_resposta: 'Aguardando resposta', proposta_enviada: 'Proposta enviada',
  aguardando_pagamento: 'Aguardando pagamento', confirmado: 'Confirmado', em_preparacao: 'Em preparação',
  concluido: 'Concluído', cancelado: 'Cancelado', em_disputa: 'Em disputa',
};

// ===================== localização =====================
export function resolveLocation(db, { q, lat, lng }) {
  const cities = db.prepare('SELECT * FROM cities').all();
  if (lat != null && lng != null && Number.isFinite(+lat) && Number.isFinite(+lng)) {
    lat = +lat; lng = +lng;
    let best = null;
    for (const c of cities) { const d = haversine(lat, lng, c.lat, c.lng); if (!best || d < best.d) best = { c, d }; }
    return { kind: 'gps', city: best && best.d <= 60 ? best.c : null, lat, lng, label: best && best.d <= 60 ? `${best.c.name}, ${best.c.state}` : 'Sua localização' };
  }
  q = String(q || '').trim();
  if (!q) return null;
  const digits = q.replace(/\D/g, '');
  if (digits.length === 8) {
    const c5 = parseInt(digits.slice(0, 5), 10);
    const city = cities.find((c) => c.cep_from <= c5 && c5 <= c.cep_to) || null;
    return { kind: 'cep', cep5: c5, city, lat: city?.lat, lng: city?.lng, label: `CEP ${digits.slice(0, 5)}-${digits.slice(5)}${city ? ' · ' + city.name : ''}` };
  }
  const first = q.split(/[,\-–/]/)[0];
  const s = slugify(first), full = slugify(q);
  const city = cities.find((c) => c.slug === s || c.slug === full || slugify(c.name) === s);
  if (city) return { kind: 'cidade', city, lat: city.lat, lng: city.lng, label: `${city.name}, ${city.state}` };
  const n = db.prepare('SELECT neighborhood, neighborhood_slug, city_slug FROM service_areas WHERE neighborhood_slug=? LIMIT 1').get(s);
  if (n) {
    const c = cities.find((c) => c.slug === n.city_slug);
    return { kind: 'bairro', city: c || null, neighborhood_slug: n.neighborhood_slug, lat: c?.lat, lng: c?.lng, label: `${n.neighborhood}${c ? ', ' + c.name : ''}` };
  }
  return { kind: 'desconhecido', city: null, label: q };
}

function areaMatch(a, loc) {
  if (a.type === 'cidade') return !!loc.city && a.city_slug === loc.city.slug;
  if (a.type === 'bairro') return !!loc.city && a.city_slug === loc.city.slug && (!loc.neighborhood_slug || a.neighborhood_slug === loc.neighborhood_slug);
  if (a.type === 'cep') return loc.cep5 != null && loc.cep5 >= a.cep_from && loc.cep5 <= a.cep_to;
  if (a.type === 'raio') return loc.lat != null && haversine(loc.lat, loc.lng, a.lat, a.lng) <= a.radius_km;
  return false;
}
export const areaLabel = (a) => a.type === 'cidade' ? a.city_slug && `${a.city_name || a.city_slug}` : a.type === 'bairro' ? a.neighborhood : a.type === 'cep' ? `CEPs ${String(a.cep_from).padStart(5, '0')}–${String(a.cep_to).padStart(5, '0')}` : `Raio de ${a.radius_km} km`;

// ===================== disponibilidade =====================
/** Informativa até o pagamento: só "confirmado" (pago) ocupa capacidade de fato. */
export function availability(db, provider, date) {
  if (!date) return { known: false };
  const t = today();
  if (date < t) return { known: true, available: false, reason: 'Data no passado' };
  if (daysBetween(t, date) < provider.min_notice_days) return { known: true, available: false, reason: `Antecedência mínima de ${provider.min_notice_days} dia(s)` };
  if (db.prepare('SELECT 1 FROM availability_blocks WHERE provider_id=? AND date=?').get(provider.id, date)) return { known: true, available: false, reason: 'Data indisponível' };
  const used = db.prepare(`SELECT COUNT(*) n FROM orders WHERE provider_id=? AND event_date=? AND status IN (${RESERVING.map(() => '?').join(',')})`).get(provider.id, date, ...RESERVING).n;
  if (used >= provider.capacity_per_day) return { known: true, available: false, reason: 'Agenda cheia nesta data' };
  return { known: true, available: true, slots_left: provider.capacity_per_day - used };
}
export function unavailableDates(db, provider, from, to) {
  const out = new Set(db.prepare('SELECT date FROM availability_blocks WHERE provider_id=? AND date BETWEEN ? AND ?').all(provider.id, from, to).map((r) => r.date));
  const rows = db.prepare(`SELECT event_date d, COUNT(*) n FROM orders WHERE provider_id=? AND event_date BETWEEN ? AND ? AND status IN (${RESERVING.map(() => '?').join(',')}) GROUP BY event_date`).all(provider.id, from, to, ...RESERVING);
  for (const r of rows) if (r.n >= provider.capacity_per_day) out.add(r.d);
  return [...out].sort();
}

// ===================== busca =====================
const norm = (s) => slugify(s).replace(/-/g, ' ');
export function providerRatings(db) {
  const m = new Map();
  for (const r of db.prepare("SELECT provider_id id, AVG(rating) avg, COUNT(*) n FROM reviews WHERE status='publicada' GROUP BY provider_id").all()) m.set(r.id, { rating: Math.round(r.avg * 10) / 10, review_count: r.n });
  return m;
}
export const parseImages = (s) => { try { return JSON.parse(s || '[]'); } catch { return []; } };

export function search(db, p) {
  const loc = p.loc || null;
  const terms = norm(p.q || '').split(' ').filter(Boolean);
  const rows = db.prepare(`SELECT s.*, c.slug cat_slug, c.name cat_name, pr.name p_name, pr.description p_desc
    FROM services s JOIN providers pr ON pr.id=s.provider_id JOIN categories c ON c.id=s.category_id
    WHERE pr.status='aprovado' AND s.active=1 AND s.hidden=0 AND c.active=1 ${p.category ? 'AND c.slug=?' : ''}`).all(...(p.category ? [p.category] : []));
  const byProv = new Map();
  for (const s of rows) {
    if (terms.length) {
      const hay = norm(`${s.name} ${s.description} ${s.cat_name} ${s.p_name} ${s.p_desc} ${s.includes}`);
      if (!terms.every((t) => hay.includes(t))) continue;
    }
    if (p.event_type && s.event_types && !s.event_types.split(',').includes(p.event_type)) continue;
    if (s.price_type !== 'orcamento') {
      if (p.max_price != null && s.price_cents > p.max_price) continue;
      if (p.min_price != null && s.price_cents < p.min_price) continue;
    }
    if (!byProv.has(s.provider_id)) byProv.set(s.provider_id, []);
    byProv.get(s.provider_id).push(s);
  }
  const provs = byProv.size ? db.prepare(`SELECT * FROM providers WHERE id IN (${[...byProv.keys()].join(',')})`).all() : [];
  const areas = new Map();
  if (provs.length) for (const a of db.prepare(`SELECT * FROM service_areas WHERE provider_id IN (${provs.map((x) => x.id).join(',')})`).all()) {
    if (!areas.has(a.provider_id)) areas.set(a.provider_id, []); areas.get(a.provider_id).push(a);
  }
  const ratings = providerRatings(db);
  const cards = [];
  for (const pr of provs) {
    let matched = null;
    if (loc && loc.kind !== 'desconhecido') {
      matched = (areas.get(pr.id) || []).find((a) => areaMatch(a, loc));
      if (!matched) continue;
    } else if (loc) continue; // localização informada, mas não reconhecida
    const av = availability(db, pr, p.date);
    if (p.available && p.date && !av.available) continue;
    const r = ratings.get(pr.id) || { rating: null, review_count: 0 };
    if (p.min_rating && (r.rating || 0) < p.min_rating) continue;
    const list = byProv.get(pr.id);
    const priced = list.filter((s) => s.price_type !== 'orcamento').sort((a, b) => a.price_cents - b.price_cents);
    const feat = list.find((s) => s.featured) || priced[0] || list[0];
    const fromPrice = priced.length ? priced[0].price_cents : null;
    let score = (pr.plan === 'premium' ? 3 : 0) + (pr.verified ? 5 : 0) + (r.rating || 3) * 2 + Math.min(r.review_count, 10) * 0.3 + list.length * 0.2;
    if (terms.length && norm(pr.name).includes(terms[0])) score += 4;
    if (loc?.city && pr.city === loc.city.name) score += 2;
    cards.push({
      id: pr.id, slug: pr.slug, name: pr.name, city: pr.city, state: pr.state, neighborhood: pr.neighborhood,
      cover_url: pr.cover_url, logo_url: pr.logo_url, verified: !!pr.verified, premium: pr.plan === 'premium', ...r,
      featured: { id: feat.id, name: feat.name, price_type: feat.price_type, price_cents: feat.price_cents, unit: feat.unit, image: parseImages(feat.images)[0] || null },
      from_price_cents: fromPrice, categories: [...new Set(list.map((s) => s.cat_name))], matching_services: list.length,
      area: matched ? (matched.type === 'raio' ? `Atende raio de ${matched.radius_km} km` : matched.type === 'bairro' ? `Atende ${matched.neighborhood}` : matched.type === 'cep' ? 'Atende seu CEP' : `Atende ${pr.city === loc?.city?.name ? pr.city : (loc?.city?.name || pr.city)}`) : `${pr.city}, ${pr.state}`,
      availability: av, score,
    });
  }
  const sort = p.sort || 'relevancia';
  if (sort === 'preco_asc') cards.sort((a, b) => (a.from_price_cents ?? 1e12) - (b.from_price_cents ?? 1e12));
  else if (sort === 'preco_desc') cards.sort((a, b) => (b.from_price_cents ?? -1) - (a.from_price_cents ?? -1));
  else if (sort === 'avaliacao') cards.sort((a, b) => (b.rating || 0) - (a.rating || 0) || b.review_count - a.review_count);
  else cards.sort((a, b) => b.score - a.score);
  return cards;
}

// ===================== preços (somente servidor) =====================
export function validateCoupon(db, code) {
  if (!code) return null;
  const c = db.prepare('SELECT * FROM coupons WHERE code=? COLLATE NOCASE').get(String(code).trim());
  if (!c || !c.active) throw bad('Cupom inválido ou inativo.');
  if (c.expires_at && c.expires_at < today()) throw bad('Este cupom expirou.');
  if (c.max_uses != null && c.uses >= c.max_uses) throw bad('Este cupom atingiu o limite de usos.');
  return c;
}

export function priceOrder(db, provider, items, { city, couponCode } = {}) {
  if (!Array.isArray(items) || !items.length) throw bad('Selecione ao menos um item.');
  let itemsC = 0, optsC = 0, lead = 0;
  const lines = [];
  for (const it of items) {
    const s = db.prepare('SELECT * FROM services WHERE id=? AND provider_id=? AND active=1').get(Number(it.service_id), provider.id);
    if (!s || s.hidden) throw bad('Um dos itens não está mais disponível.');
    if (s.price_type === 'orcamento') throw bad(`"${s.name}" é sob orçamento: solicite uma proposta.`);
    const qty = Number(it.qty ?? 1);
    if (!Number.isInteger(qty) || qty < 1 || qty > 100000) throw bad('Quantidade inválida.');
    if (qty < s.min_qty) throw bad(`Quantidade mínima de "${s.name}": ${s.min_qty}.`);
    const ids = [...new Set((it.option_ids || []).map(Number))];
    const opts = ids.map((id) => {
      const o = db.prepare('SELECT * FROM service_options WHERE id=? AND service_id=? AND active=1').get(id, s.id);
      if (!o) throw bad('Adicional inválido.');
      return o;
    });
    const oc = opts.reduce((t, o) => t + o.price_cents, 0);
    const line = s.price_cents * qty;
    itemsC += line; optsC += oc; lead = Math.max(lead, s.lead_days);
    lines.push({ service_id: s.id, name: s.name, qty, unit: s.unit, unit_cents: s.price_cents, options: opts.map((o) => ({ id: o.id, name: o.name, price_cents: o.price_cents })), options_cents: oc, total_cents: line + oc, price_type: s.price_type });
  }
  return finishPricing(db, provider, { itemsC, optsC, city, couponCode, lead, lines });
}

export function finishPricing(db, provider, { itemsC, optsC = 0, city, couponCode, lead = 0, lines = [] }) {
  const coupon = validateCoupon(db, couponCode);
  const base = itemsC + optsC;
  let discount = 0;
  if (coupon) discount = Math.min(base, coupon.kind === 'percentual' ? Math.round((base * coupon.value) / 100) : coupon.value);
  const sameCity = city && slugify(city) === slugify(provider.city);
  const travel = sameCity || !city ? 0 : provider.travel_fee_cents;
  const feeBps = Number(getSetting(db, 'customer_fee_bps', 0));
  const fee = Math.round(((base - discount) * feeBps) / 10000);
  const total = base - discount + travel + fee;
  const bps = provider.commission_bps ?? Number(getSetting(db, provider.plan === 'premium' ? 'premium_commission_bps' : 'commission_bps', 750));
  const commission = Math.round(((base - discount + travel) * bps) / 10000);
  return { lines, items_cents: itemsC, options_cents: optsC, travel_cents: travel, discount_cents: discount, fee_cents: fee, total_cents: total,
    commission_bps: bps, commission_cents: commission, net_cents: base - discount + travel - commission, coupon_code: coupon?.code || null, lead_days: Math.max(lead, provider.min_notice_days) };
}

// ===================== pedidos =====================
export function addHistory(db, orderId, status, note, actor) {
  db.prepare('INSERT INTO order_history(order_id,status,note,actor) VALUES(?,?,?,?)').run(orderId, status, note ?? null, actor ?? null);
}
export function setStatus(db, order, status, note, actor) {
  db.prepare("UPDATE orders SET status=?, updated_at=datetime('now') WHERE id=?").run(status, order.id);
  addHistory(db, order.id, status, note, actor);
  if (order.quote_id) db.prepare('UPDATE quote_requests SET status=? WHERE id=?').run(status, order.quote_id);
  order.status = status;
}
const provUser = (db, pid) => db.prepare('SELECT user_id FROM providers WHERE id=?').get(pid)?.user_id;

export function createOrder(db, user, b) {
  const provider = db.prepare("SELECT * FROM providers WHERE id=? AND status='aprovado'").get(b.provider_id);
  if (!provider) throw new HttpError(404, 'Fornecedor não encontrado.');
  return tx(db, () => {
    const pr = priceOrder(db, provider, b.items, { city: b.city, couponCode: b.coupon });
    const minDate = addDays(today(), pr.lead_days);
    if (b.event_date < minDate) throw bad(`Este pedido exige antecedência mínima de ${pr.lead_days} dia(s) (a partir de ${minDate.split('-').reverse().join('/')}).`);
    const av = availability(db, provider, b.event_date);
    if (!av.available) throw new HttpError(409, `Fornecedor indisponível nesta data: ${av.reason}.`);
    const id = db.prepare(`INSERT INTO orders(user_id,provider_id,event_id,status,event_date,address,city,notes,items_cents,options_cents,travel_cents,discount_cents,fee_cents,total_cents,commission_bps,commission_cents,net_cents,coupon_code)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(user.id, provider.id, b.event_id ?? null, 'aguardando_resposta', b.event_date, b.address ?? null, b.city ?? null, b.notes ?? null,
      pr.items_cents, pr.options_cents, pr.travel_cents, pr.discount_cents, pr.fee_cents, pr.total_cents, pr.commission_bps, pr.commission_cents, pr.net_cents, pr.coupon_code).lastInsertRowid;
    for (const l of pr.lines) db.prepare('INSERT INTO order_items(order_id,service_id,name,qty,unit,unit_cents,options,options_cents,total_cents) VALUES(?,?,?,?,?,?,?,?,?)')
      .run(id, l.service_id, l.name, l.qty, l.unit, l.unit_cents, JSON.stringify(l.options), l.options_cents, l.total_cents);
    addHistory(db, id, 'solicitado', 'Pedido criado pelo cliente', 'cliente');
    addHistory(db, id, 'aguardando_resposta', 'Aguardando o fornecedor aceitar o pedido', 'sistema');
    if (b.event_id) for (const l of pr.lines) db.prepare('DELETE FROM event_items WHERE event_id=? AND service_id=?').run(b.event_id, l.service_id);
    notify(db, provUser(db, provider.id), 'Novo pedido recebido', `${user.name} solicitou ${pr.lines.length} item(ns) para ${b.event_date.split('-').reverse().join('/')}. Líquido previsto: ${money(pr.net_cents)}.`, `/fornecedor/pedidos/${id}`);
    return id;
  });
}

export function orderFromProposal(db, user, quoteId, proposalId) {
  return tx(db, () => {
    const q = db.prepare('SELECT * FROM quote_requests WHERE id=? AND user_id=?').get(quoteId, user.id);
    if (!q) throw new HttpError(404, 'Solicitação não encontrada.');
    const pp = db.prepare("SELECT * FROM proposals WHERE id=? AND quote_id=? AND status='enviada'").get(proposalId, quoteId);
    if (!pp) throw bad('Proposta indisponível.');
    if (pp.valid_until < today()) { db.prepare("UPDATE proposals SET status='expirada' WHERE id=?").run(pp.id); throw bad('Esta proposta expirou. Peça uma nova ao fornecedor.'); }
    const provider = db.prepare("SELECT * FROM providers WHERE id=? AND status='aprovado'").get(q.provider_id);
    if (!provider) throw bad('Fornecedor indisponível.');
    const av = availability(db, provider, q.date);
    if (!av.available) throw new HttpError(409, `Fornecedor indisponível nesta data: ${av.reason}.`);
    const pr = finishPricing(db, provider, { itemsC: pp.price_cents, city: q.city });
    const id = db.prepare(`INSERT INTO orders(user_id,provider_id,event_id,quote_id,proposal_id,status,event_date,address,city,notes,items_cents,options_cents,travel_cents,discount_cents,fee_cents,total_cents,commission_bps,commission_cents,net_cents)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(user.id, provider.id, q.event_id, q.id, pp.id, 'aguardando_pagamento', q.date, q.location, q.city, q.notes,
      pr.items_cents, 0, pr.travel_cents, 0, pr.fee_cents, pr.total_cents, pr.commission_bps, pr.commission_cents, pr.net_cents).lastInsertRowid;
    const svc = q.service_id ? db.prepare('SELECT name FROM services WHERE id=?').get(q.service_id) : null;
    db.prepare('INSERT INTO order_items(order_id,service_id,name,qty,unit,unit_cents,options,options_cents,total_cents) VALUES(?,?,?,?,?,?,?,?,?)')
      .run(id, q.service_id, `Proposta: ${svc?.name || 'serviço personalizado'}`, 1, 'proposta', pp.price_cents, '[]', 0, pp.price_cents);
    addHistory(db, id, 'solicitado', 'Solicitação de orçamento', 'cliente');
    addHistory(db, id, 'proposta_enviada', 'Proposta enviada pelo fornecedor', 'fornecedor');
    addHistory(db, id, 'aguardando_pagamento', 'Cliente aceitou a proposta', 'cliente');
    db.prepare("UPDATE proposals SET status='aceita' WHERE id=?").run(pp.id);
    db.prepare("UPDATE proposals SET status='substituida' WHERE quote_id=? AND id<>? AND status='enviada'").run(q.id, pp.id);
    db.prepare("UPDATE quote_requests SET status='aguardando_pagamento' WHERE id=?").run(q.id);
    notify(db, provUser(db, provider.id), 'Proposta aceita', `${user.name} aceitou sua proposta. Aguardando pagamento.`, `/fornecedor/pedidos/${id}`);
    return id;
  });
}

export function startPayment(db, order) {
  if (order.status !== 'aguardando_pagamento') throw bad('Este pedido não está aguardando pagamento.');
  const open = db.prepare("SELECT * FROM payments WHERE order_id=? AND status='pendente' AND amount_cents=?").get(order.id, order.total_cents);
  if (open) return open; // idempotente: reaproveita a cobrança em aberto
  const ch = createCharge({ orderId: order.id, amountCents: order.total_cents });
  const n = db.prepare('SELECT COUNT(*) n FROM payments WHERE order_id=?').get(order.id).n + 1;
  const id = db.prepare('INSERT INTO payments(order_id,provider,external_id,idempotency_key,amount_cents) VALUES(?,?,?,?,?)')
    .run(order.id, ch.provider, ch.externalId, `order-${order.id}-try-${n}`, order.total_cents).lastInsertRowid;
  return db.prepare('SELECT * FROM payments WHERE id=?').get(id);
}

export function refundPolicyCents(order) {
  const d = daysBetween(today(), order.event_date);
  const pct = d >= 7 ? 100 : d >= 2 ? 50 : 0;
  return Math.round((order.total_cents * pct) / 100);
}

export function refundOrder(db, order, cents, reason, actor) {
  if (cents <= 0) return 0;
  const pay = db.prepare("SELECT * FROM payments WHERE order_id=? AND status IN ('aprovado','estorno_parcial') ORDER BY id DESC").get(order.id);
  if (!pay) return 0;
  cents = Math.min(cents, pay.amount_cents - pay.refunded_cents);
  if (cents <= 0) return 0;
  refundCharge(pay, cents);
  const total = pay.refunded_cents + cents;
  db.prepare('UPDATE payments SET refunded_cents=?, status=? WHERE id=?').run(total, total >= pay.amount_cents ? 'estornado' : 'estorno_parcial', pay.id);
  db.prepare('UPDATE orders SET refunded_cents=refunded_cents+? WHERE id=?').run(cents, order.id);
  addHistory(db, order.id, order.status, `Estorno de ${money(cents)} (${reason})`, actor);
  notify(db, order.user_id, 'Estorno registrado', `${money(cents)} referente ao pedido #${order.id} (${reason}).`, `/pedidos/${order.id}`);
  return cents;
}

/** Processa evento do provedor (real via webhook, ou o simulado do modo teste). Idempotente pelo id do evento. */
export function processPaymentEvent(db, ev) {
  return tx(db, () => {
    if (db.prepare('SELECT 1 FROM webhook_events WHERE id=?').get(ev.id)) return { duplicate: true };
    db.prepare('INSERT INTO webhook_events(id,type) VALUES(?,?)').run(ev.id, ev.type);
    const pay = db.prepare('SELECT * FROM payments WHERE external_id=?').get(ev.external_id);
    if (!pay) throw new HttpError(404, 'Pagamento desconhecido.');
    const order = db.prepare('SELECT * FROM orders WHERE id=?').get(pay.order_id);
    if (ev.type === 'payment.failed') {
      if (pay.status === 'pendente') db.prepare("UPDATE payments SET status='falhou' WHERE id=?").run(pay.id);
      notify(db, order.user_id, 'Pagamento não aprovado', `O pagamento do pedido #${order.id} não foi aprovado. Tente novamente.`, `/pedidos/${order.id}`);
      return { ok: true, status: 'falhou' };
    }
    if (ev.type !== 'payment.approved') return { ok: true, ignored: true };
    if (pay.status !== 'pendente') return { ok: true, ignored: true };
    if (ev.amount_cents !== pay.amount_cents || pay.amount_cents !== order.total_cents) {
      db.prepare("UPDATE payments SET status='falhou' WHERE id=?").run(pay.id);
      audit(db, null, 'pagamento_valor_divergente', 'payment', pay.id, { esperado: order.total_cents, recebido: ev.amount_cents });
      return { ok: false, divergent: true };
    }
    db.prepare("UPDATE payments SET status='aprovado', paid_at=datetime('now'), method=? WHERE id=?").run(ev.method || null, pay.id);
    const provider = db.prepare('SELECT * FROM providers WHERE id=?').get(order.provider_id);
    if (order.status !== 'aguardando_pagamento' || !availability(db, provider, order.event_date).available) {
      // pagamento chegou tarde demais (pedido cancelado ou data ocupada nesse meio-tempo): devolve integralmente
      refundOrder(db, { ...order }, pay.amount_cents, 'data ocupada ou pedido não mais pendente', 'sistema');
      if (order.status === 'aguardando_pagamento') setStatus(db, order, 'cancelado', 'Data não está mais disponível; pagamento estornado', 'sistema');
      notify(db, order.user_id, 'Pedido não confirmado', 'A data ficou indisponível antes da confirmação do pagamento. O valor foi estornado.', `/pedidos/${order.id}`);
      return { ok: true, status: 'estornado_por_indisponibilidade' };
    }
    setStatus(db, order, 'confirmado', 'Pagamento aprovado — data reservada', 'sistema');
    if (order.coupon_code) db.prepare('UPDATE coupons SET uses=uses+1 WHERE code=? COLLATE NOCASE').run(order.coupon_code);
    notify(db, order.user_id, 'Pedido confirmado', `Pagamento aprovado! O pedido #${order.id} está confirmado.`, `/pedidos/${order.id}`);
    notify(db, provUser(db, order.provider_id), 'Pagamento recebido', `Pedido #${order.id} confirmado para ${order.event_date.split('-').reverse().join('/')}.`, `/fornecedor/pedidos/${order.id}`);
    return { ok: true, status: 'confirmado' };
  });
}

export function completeOrder(db, order, actor) {
  setStatus(db, order, 'concluido', 'Serviço concluído', actor);
  db.prepare('INSERT OR IGNORE INTO payouts(provider_id,order_id,amount_cents) VALUES(?,?,?)').run(order.provider_id, order.id, order.net_cents);
  notify(db, order.user_id, 'Serviço concluído', `Que tal avaliar o fornecedor? Pedido #${order.id}.`, `/pedidos/${order.id}`);
}

// ===================== resumo do evento =====================
export function eventSummary(db, ev) {
  const items = db.prepare(`SELECT ei.*, s.name, s.price_type, s.price_cents, s.unit, s.min_qty, s.provider_id, s.images, c.name cat_name, c.slug cat_slug, p.name provider_name, p.slug provider_slug
    FROM event_items ei JOIN services s ON s.id=ei.service_id JOIN categories c ON c.id=s.category_id JOIN providers p ON p.id=s.provider_id WHERE ei.event_id=?`).all(ev.id);
  let planned = 0, quoteCount = 0;
  const planItems = items.map((i) => {
    const ids = JSON.parse(i.option_ids || '[]');
    const opts = ids.length ? db.prepare(`SELECT id,name,price_cents FROM service_options WHERE service_id=? AND id IN (${ids.map(Number).join(',')})`).all(i.service_id) : [];
    const oc = opts.reduce((t, o) => t + o.price_cents, 0);
    const total = i.price_type === 'orcamento' ? null : i.price_cents * i.qty + oc;
    if (total == null) quoteCount++; else planned += total;
    return { id: i.id, service_id: i.service_id, name: i.name, qty: i.qty, unit: i.unit, price_type: i.price_type, unit_cents: i.price_cents, options: opts, total_cents: total,
      category: i.cat_name, category_slug: i.cat_slug, provider_id: i.provider_id, provider_name: i.provider_name, provider_slug: i.provider_slug, image: parseImages(i.images)[0] || null };
  });
  const orders = db.prepare(`SELECT o.id,o.status,o.total_cents,o.event_date,p.name provider_name,p.slug provider_slug FROM orders o JOIN providers p ON p.id=o.provider_id WHERE o.event_id=?`).all(ev.id);
  const contracted = orders.filter((o) => o.status !== 'cancelado').reduce((t, o) => t + o.total_cents, 0);
  const cats = db.prepare('SELECT slug,name,icon FROM categories WHERE active=1 ORDER BY position').all();
  const covered = new Set(planItems.map((i) => i.category_slug));
  for (const o of db.prepare('SELECT DISTINCT c.slug FROM order_items oi JOIN services s ON s.id=oi.service_id JOIN categories c ON c.id=s.category_id JOIN orders o ON o.id=oi.order_id WHERE o.event_id=? AND o.status<>?').all(ev.id, 'cancelado')) covered.add(o.slug);
  return { items: planItems, orders, planned_cents: planned, contracted_cents: contracted, quote_pending: quoteCount,
    total_cents: planned + contracted, budget_cents: ev.budget_cents, needs: cats.map((c) => ({ ...c, covered: covered.has(c.slug) })) };
}

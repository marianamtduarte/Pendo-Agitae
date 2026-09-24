import { api, state, html, raw, route, act, form, field, empty, stars, money, fmtDate, priceLabel, priceKind, EVENT_TYPE, store, toast, go, openDialog, closeDialog, errBox, needLogin, icon, t, track, render } from './core.js';
import { savedLoc, locField, saveLoc } from './loc.js';

const today = () => state.config?.today || new Date().toISOString().slice(0, 10);
const cats = () => state.config?.categories || [];
const catBySlug = (s) => cats().find((c) => c.slug === s);
const disc = (i) => `background:hsl(${(i * 47 + 12) % 360} 90% 91%)`;
const locQuery = () => { const s = savedLoc(); return s.lat ? `lat=${s.lat}&lng=${s.lng}` : s.q ? `loc=${encodeURIComponent(s.q)}` : ''; };

// ---------------- cartão de fornecedor ----------------
export function providerCard(p, date) {
  const av = p.availability || {};
  return html`<article class="card pcard"><button class="favq" data-act="fav-quick" data-id="${p.id}" aria-pressed="${!!p.favorite}" aria-label="${t('Salvar fornecedor')}">${icon('heart', 18)}</button>
    <a href="#/f/${p.slug}${date ? '?date=' + date : ''}" data-track="provider_card_click" data-name="${p.name}">
    <div class="media"><img src="${p.cover_url}" alt="${t('Imagem de capa (fictícia) de {n}', { n: p.name })}" loading="lazy"><div class="badges">${p.verified ? html`<span class="tag ok">${icon('check', 13)} ${t('Verificado')}</span>` : ''}${p.premium ? html`<span class="tag orange">★ Premium</span>` : ''}</div></div>
    <div class="body">
      <div class="line"><h3>${p.name}</h3>${stars(p.rating, p.review_count)}</div>
      <div class="meta">${p.categories.slice(0, 3).join(' · ')}</div>
      <div class="meta" style="display:flex;gap:5px;align-items:center">${icon('pin', 15)} ${p.city}/${p.state} · ${p.area}</div>
      ${av.known ? (av.available ? html`<span class="tag ok" style="align-self:flex-start">${t('Disponível em {d}', { d: fmtDate(date) })}</span>` : html`<span class="tag bad" style="align-self:flex-start">${t('Indisponível')}: ${av.reason}</span>`) : ''}
      <div class="foot"><span class="meta">${p.featured.name}</span>${p.from_price_cents != null ? html`<span class="price"><small>${t('a partir de')}</small> ${money(p.from_price_cents)}</span>` : html`<span class="price">${t('Sob orçamento')}</span>`}</div>
    </div></a></article>`;
}
document.addEventListener('click', (e) => { const a = e.target.closest('[data-track]'); if (a) track(a.dataset.track, { name: a.dataset.name }); });
act('fav-quick', async (el, e) => {
  e.preventDefault(); e.stopPropagation();
  if (!state.user) return needLogin();
  const on = el.getAttribute('aria-pressed') === 'true';
  await api('/favorites/' + el.dataset.id, { method: on ? 'DELETE' : 'POST' });
  el.setAttribute('aria-pressed', String(!on)); toast(on ? t('Removido dos salvos.') : t('Fornecedor salvo!')); if (!on) track('provider_favorited', { id: el.dataset.id });
});

// ---------------- home ----------------
const WAVE = raw('<svg class="wave" viewBox="0 0 1440 60" preserveAspectRatio="none" aria-hidden="true"><path d="M0 30 C240 70 480 0 720 25 S1200 65 1440 20 V60 H0Z" fill="#F6F7FB"/></svg>');
route('/', async (ctx) => {
  const s = savedLoc(), qs = locQuery();
  const [near, all] = await Promise.all([api('/search?' + qs), qs ? api('/search') : null]);
  const base = all || near;
  const top = [...base.results].sort((a, b) => (b.rating || 0) - (a.rating || 0) || b.review_count - a.review_count).slice(0, 8);
  const banners = state.config?.banners || [];
  ctx.title = t('Organize sua festa de forma rápida e fácil.');
  const promo = banners.length ? banners.slice(0, 2) : null;
  const types = [['🎂', t('Aniversário'), ['doces-salgados', 'bolos', 'decoracao', 'fotografia'], '#FF7C00,#FFAA50'], ['🎈', t('Festa infantil'), ['recreacao-infantil', 'brinquedos', 'decoracao', 'bolos'], '#7A4DE8,#A98BFF'], ['💍', t('Casamento'), ['espaco-eventos', 'buffet', 'cerimonial', 'flores'], '#E5306B,#FF7DA3'], ['🎓', t('Formatura'), ['buffet', 'dj-musica', 'fotografia', 'iluminacao-som'], '#0E9F8E,#3FD2BF']];
  return html`<section class="hero"><div class="wrap"><div>
    <h1>${t('Organize sua festa de forma')} <span class="mark">${t('rápida e fácil.')}</span></h1>
    <p class="lead">${t('Diga onde e quando será, compare fornecedores da sua região e contrate tudo em um só lugar.')}</p>
    <form class="searchbox" data-form="search" role="search" aria-label="${t('Buscar serviços para festa')}">
      <div class="field c-q"><label for="q">${t('O que você precisa para a sua festa?')}</label><input id="q" name="q" placeholder="${t('Ex.: bolo, fotógrafo, buffet, DJ…')}" autocomplete="off"></div>
      <div class="c-l">${locField()}</div>
      ${field(t('Data do evento'), 'date', { type: 'date', min: today(), cls: 'c-s' })}
      ${field(t('Tipo de festa'), 'event_type', { type: 'select', cls: 'c-s', options: [['', t('Qualquer')], ...Object.entries(EVENT_TYPE())] })}
      ${field(t('Convidados'), 'guests', { type: 'number', attrs: 'min="1" inputmode="numeric"', cls: 'c-s', placeholder: t('Ex.: 50') })}
      <div class="c-go" style="display:flex;align-items:flex-end"><button class="btn orange block" type="submit">${icon('search', 18)} ${t('Buscar fornecedores')}</button></div>
      <p class="meta tiny hint">${t('Você pode explorar sem preencher tudo. Data e local ajudam a mostrar só quem atende você.')}</p>
    </form></div>
    <div class="collage" aria-hidden="true"><div class="b b1">🎂</div><div class="b b2">🎈</div><div class="b b3">📸</div><div class="b b4">🎧</div></div></div>${WAVE}</section>
  <div class="wrap" style="padding-bottom:20px">
    <section class="section" style="margin-top:8px" aria-labelledby="cats"><div class="row between"><h2 id="cats">${t('O que você procura?')}</h2></div>
      <div class="catrow">${cats().map((c, i) => html`<a class="catc" href="#/categoria/${c.slug}" data-track="category_click" data-name="${c.slug}"><div class="disc" style="${disc(i)}" aria-hidden="true">${c.icon}</div>${c.name}</a>`)}</div></section>
    <section class="section"><div class="promo">${promo ? promo.map((b, i) => html`<a class="p${i + 1}" href="${b.link || '#/busca'}"><h3>${b.title}</h3><p>${b.text || ''}</p><span class="btn ${i ? 'orange' : 'ghost'} sm">${t('Saiba mais')} ${icon('arrow', 16)}</span></a>`) : html`<a class="p1" href="#/busca"><h3>${t('Primeira festa na Agitaê?')}</h3><p>${t('Use o cupom BEMVINDO10 e ganhe 10% de desconto.')}</p></a><a class="p2" href="#/fornecedor/cadastro"><h3>${t('Fornecedor? Cadastre-se grátis')}</h3></a>`}</div></section>
    <section class="section"><div class="row between"><h2>${qs ? t('Fornecedores perto de você') : t('Fornecedores em destaque')}</h2>${qs ? html`<span class="meta">${icon('pin', 15)} ${s.q || t('Minha localização')} · <a href="#/busca?${qs}">${t('Ver todos')}</a></span>` : html`<a class="linkmore" href="#/busca">${t('Ver todos')} →</a>`}</div>
      ${!qs ? html`<div class="notice info">${t('Informe seu local no topo da página para ver só quem atende a sua região.')}</div>` : ''}
      ${near.results.length ? html`<div class="rail">${near.results.slice(0, 10).map((p) => providerCard(p))}</div>` : emptyRegion(near, s.q)}</section>
    <section class="section"><div class="row between"><h2>${t('Serviços populares')}</h2><a class="linkmore" href="#/busca">${t('Ver todos')} →</a></div>
      <div class="rail">${base.results.slice(0, 10).map((p) => html`<article class="card pcard svcmini"><a href="#/f/${p.slug}"><div class="media"><img src="${p.featured.image || p.cover_url}" alt="${t('Imagem fictícia de {n}', { n: p.featured.name })}" loading="lazy"></div><div class="body"><h3>${p.featured.name}</h3><span class="meta">${p.name} · ${p.city}</span>${priceLabel(p.featured)}</div></a></article>`)}</div></section>
    ${top.length ? html`<section class="section"><div class="row between"><h2>${t('Mais bem avaliados')}</h2></div><div class="rail">${top.map((p) => providerCard(p))}</div></section>` : ''}
    <section class="section"><h2>${t('Comece a planejar por tipo de festa')}</h2><div class="tiles">${types.map(([i, n, cs, g]) => html`<div class="tile" style="background:linear-gradient(135deg,${g.split(',')[0]},${g.split(',')[1]})"><div class="big" aria-hidden="true">${i}</div><h3>${n}</h3><div class="chips">${cs.map((c) => html`<a class="chip" href="#/categoria/${c}">${catBySlug(c)?.name || c}</a>`)}</div></div>`)}</div>
      <p style="margin-top:14px"><a class="btn ghost" href="#/eventos">${icon('cal', 18)} ${t('Criar minha festa e montar o planejamento')}</a></p></section>
    <section class="section"><h2>${t('Como funciona')}</h2><div class="steps">
      <div class="step"><div class="n" aria-hidden="true">📝</div><h3>1. ${t('Organize')}</h3><p class="meta">${t('Diga onde, quando e que tipo de festa você quer fazer.')}</p></div>
      <div class="step"><div class="n" aria-hidden="true">🔎</div><h3>2. ${t('Encontre')}</h3><p class="meta">${t('Compare fornecedores da sua região, preços e avaliações.')}</p></div>
      <div class="step"><div class="n" aria-hidden="true">📅</div><h3>3. ${t('Agende')}</h3><p class="meta">${t('Peça orçamento ou contrate. A data é reservada após o pagamento.')}</p></div>
      <div class="step"><div class="n" aria-hidden="true">🎉</div><h3>4. ${t('Realize')}</h3><p class="meta">${t('Acompanhe o pedido, converse com o fornecedor e curta a festa.')}</p></div></div></section>
    <section class="section"><div class="trust"><div>${icon('shield', 26)}<div><h3>${t('Contratação segura')}</h3><p class="meta">${t('Preços e taxas claros antes de pagar, com política de cancelamento visível.')}</p></div></div>
      <div>${icon('star', 26)}<div><h3>${t('Avaliações reais')}</h3><p class="meta">${t('Só quem concluiu uma contratação pode avaliar o fornecedor.')}</p></div></div>
      <div>${icon('pin', 26)}<div><h3>${t('Perto de você')}</h3><p class="meta">${t('Mostramos fornecedores que realmente atendem o seu endereço.')}</p></div></div></div></section>
    <section class="section"><div class="cta"><h2>${t('Tem um negócio de festas?')}</h2><p>${t('Alcance clientes da sua região sem mensalidade: você só paga uma comissão quando vender.')}</p><div><a class="btn orange" href="#/fornecedor/cadastro">${t('Cadastre seu negócio')}</a></div></div></section>
  </div>`;
});
function emptyRegion(res, q) {
  if (res.empty_reason === 'local_desconhecido') return empty('🗺️', t('Não reconhecemos esse local'), t('Tente um CEP completo, o nome da cidade ou o bairro.'));
  return empty('🚧', t('Ainda não chegamos por aí'), t('Ainda não temos fornecedores nesta região. Já atendemos: {c}.', { c: (res.other_cities || []).map((c) => c.name).join(', ') || '—' }), html`<a class="btn ghost" href="#/fornecedor/cadastro">${t('Conhece um fornecedor? Indique o cadastro')}</a>`);
}
form('search', (d) => {
  saveLoc(d); if (d.guests) store.set('guests', d.guests);
  const p = new URLSearchParams(); for (const [k, v] of Object.entries(d)) if (v !== '' && v != null && k !== 'guests') p.set(k, v);
  track('search_performed', { q: d.q || '', loc: d.loc || '', date: d.date || '', event_type: d.event_type || '' });
  go('#/busca?' + p);
});

// ---------------- busca / categoria ----------------
async function searchPage(ctx) {
  const q = { ...ctx.query }; if (ctx.params.slug) q.category = ctx.params.slug;
  const c = q.category ? catBySlug(q.category) : null;
  if (!q.loc && !q.lat && !('nolocation' in q)) { const s = savedLoc(); if (s.lat) { q.lat = s.lat; q.lng = s.lng; q.loc = s.q; } else if (s.q) q.loc = s.q; }
  const usp = new URLSearchParams(); for (const k of ['q', 'loc', 'lat', 'lng', 'category', 'date', 'event_type', 'min_price', 'max_price', 'min_rating', 'available', 'sort']) if (q[k]) usp.set(k, q[k]);
  const res = await api('/search?' + usp);
  ctx.title = c ? c.name : t('Buscar fornecedores');
  const catLink = (slug) => `#/${slug ? 'categoria/' + slug : 'busca'}${q.loc ? '?loc=' + encodeURIComponent(q.loc) : ''}`;
  return html`<div class="wrap page"><div class="pagehead"><div><h1>${c ? html`<span aria-hidden="true">${c.icon}</span> ${c.name}` : t('Buscar fornecedores')}</h1>
    <p class="meta" role="status">${t('{n} fornecedor(es)', { n: res.total })}${res.location ? html` · ${icon('pin', 14)} ${res.location.label}` : ' · ' + t('todas as regiões')}${q.date ? ' · ' + fmtDate(q.date) : ''}</p></div>
    <button class="btn ghost sm filtertoggle" data-act="toggle-filters">${t('Filtros')}</button></div>
    <div class="catrow" style="margin-bottom:8px"><a class="chip" style="${!c ? 'background:var(--ink);color:#fff' : ''};padding:7px 14px" href="${catLink('')}">${t('Todas')}</a>${cats().map((x) => html`<a class="chip" style="${c?.slug === x.slug ? 'background:var(--ink);color:#fff' : ''};padding:7px 14px;white-space:nowrap" href="${catLink(x.slug)}">${x.icon} ${x.name}</a>`)}</div>
    <div class="layout" id="searchlayout"><form class="card pad filters" data-form="refine" aria-label="${t('Filtros')}">
      <h2>${t('Filtros')}</h2>
      ${field(t('Buscar'), 'q', { value: q.q, placeholder: t('nome, serviço, palavra-chave') })}
      ${field(t('Categoria'), 'category', { type: 'select', value: q.category || '', options: [['', t('Todas')], ...cats().map((x) => [x.slug, x.name])] })}
      ${locField('r-', q.loc || '')}
      ${field(t('Data do evento'), 'date', { type: 'date', value: q.date, min: today() })}
      <label class="check"><input type="checkbox" name="available" value="1" ${q.available ? 'checked' : ''}> <span>${t('Só fornecedores disponíveis na data')}</span></label>
      ${field(t('Tipo de festa'), 'event_type', { type: 'select', value: q.event_type || '', options: [['', t('Qualquer')], ...Object.entries(EVENT_TYPE())] })}
      <div class="inline">${field(t('Preço mín. (R$)'), 'min_price', { type: 'number', value: q.min_price, attrs: 'min="0" step="1"' })}${field(t('Preço máx. (R$)'), 'max_price', { type: 'number', value: q.max_price, attrs: 'min="0" step="1"' })}</div>
      ${field(t('Avaliação mínima'), 'min_rating', { type: 'select', value: q.min_rating || '', options: [['', t('Qualquer')], ['3', t('3★ ou mais')], ['4', t('4★ ou mais')], ['4.5', t('4,5★ ou mais')]] })}
      ${field(t('Ordenar por'), 'sort', { type: 'select', value: q.sort || 'relevancia', options: [['relevancia', t('Relevância')], ['preco_asc', t('Menor preço')], ['preco_desc', t('Maior preço')], ['avaliacao', t('Melhor avaliação')]] })}
      <button class="btn" type="submit">${t('Aplicar filtros')}</button>
      <p class="meta tiny">${t('Tipos de preço')}: <span class="tag ok">${t('Preço fechado')}</span> <span class="tag info">${t('A partir de')}</span> <span class="tag orange">${t('Sob orçamento')}</span></p>
    </form>
    <div>${res.results.length ? html`<div class="grid g2">${res.results.map((p) => providerCard(p, q.date))}</div>` : (res.empty_reason === 'sem_resultados' ? empty('🔎', t('Nada encontrado'), t('Tente outros termos ou remova alguns filtros.')) : emptyRegion(res, q.loc))}</div></div></div>`;
}
act('toggle-filters', () => document.getElementById('searchlayout')?.classList.toggle('fopen'));
form('refine', (d) => { saveLoc(d); const p = new URLSearchParams(); for (const [k, v] of Object.entries(d)) if (v !== '' && v != null) p.set(k, v); if (!d.loc && !d.lat) p.set('nolocation', '1'); go('#/busca?' + p); });
route('/busca', searchPage); route('/categoria/:slug', searchPage);

// ---------------- perfil do fornecedor ----------------
let P = null;
const cartOf = (p) => (state.cart && state.cart.provider_id === p.id ? state.cart : null);
const estimate = (i) => (i.unit_cents || 0) * i.qty + (i.opts_cents || 0);
function cartPanel() {
  const p = P.provider, c = cartOf(p), total = c ? c.items.reduce((s, i) => s + estimate(i), 0) : 0;
  return html`<h3>${icon('bag', 20)} ${t('Seu pedido')}</h3>${c && c.items.length ? html`<ul class="cartlist">${c.items.map((i, n) => html`<li><div class="row between"><strong>${i.name}</strong><button class="btn ghost sm" data-act="cart-remove" data-n="${n}" aria-label="${t('Remover {n}', { n: i.name })}">✕</button></div><div class="row between meta"><span>${i.qty} × ${i.unit || ''}${i.opt_names ? ' + ' + i.opt_names : ''}</span><strong>${money(estimate(i))}</strong></div></li>`)}</ul>
    <div class="row between"><span class="meta">${t('Estimativa (sem deslocamento e descontos)')}</span><strong>${money(total)}</strong></div><a class="btn orange block" style="margin-top:12px" href="#/checkout" data-track="checkout_started" data-name="${p.name}">${t('Continuar para a contratação')}</a>`
    : html`<p class="meta">${t('Escolha itens do catálogo para contratar. Para serviços sob orçamento, peça uma proposta.')}</p>`}
    <hr style="border:0;border-top:1px solid var(--line);margin:14px 0"><ul class="meta" style="padding-left:18px;margin:0 0 12px"><li>${t('Preços e taxas claros antes de pagar')}</li><li>${t('Data reservada após confirmação do pagamento')}</li><li>${t('Cancelamento: reembolso de 100% até 7 dias antes; 50% de 2 a 6 dias')}</li></ul>
    <button class="btn ghost block" data-act="quote-open" data-service="">${icon('chat', 18)} ${t('Conversar / pedir orçamento')}</button>`;
}
const refreshCart = () => { const el = document.getElementById('cartpanel'); if (el) el.innerHTML = cartPanel().s; };
route('/f/:slug', async (ctx) => {
  const d = (P = await api(`/providers/${ctx.params.slug}${ctx.query.date ? '?date=' + ctx.query.date : ''}`));
  const p = d.provider; P.unav = await api(`/providers/${p.slug}/unavailable`).catch(() => ({ dates: [] }));
  ctx.title = p.name; store.set('last_provider', p.slug); track('provider_viewed', { slug: p.slug, name: p.name });
  const hist = [1, 2, 3, 4, 5].map((n) => d.reviews.filter((r) => r.rating === n).length);
  ctx.mount = () => {
    const links = [...document.querySelectorAll('.stickytabs a')], secs = links.map((a) => document.getElementById(a.dataset.to)).filter(Boolean);
    if (!('IntersectionObserver' in window) || !secs.length) return;
    const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) links.forEach((a) => a.setAttribute('aria-current', String(a.dataset.to === e.target.id))); }), { rootMargin: '-140px 0px -65% 0px' });
    secs.forEach((s) => io.observe(s));
  };
  return html`<div>${p.status !== 'aprovado' ? html`<div class="wrap"><div class="notice">${t('Este perfil está {s} e só é visível para você e a administração.', { s: p.status })}</div></div>` : ''}
    <div class="pcover"><img src="${p.cover_url}" alt="${t('Capa (fictícia) de {n}', { n: p.name })}"><div class="actions"><button class="iconbtn" data-act="fav" data-id="${p.id}" aria-pressed="${d.favorite}" aria-label="${t('Salvar fornecedor')}">${icon('heart', 20)}</button><button class="iconbtn" data-act="share" aria-label="${t('Compartilhar')}">${icon('share', 20)}</button></div></div>
    <div class="wrap"><div class="pinfo"><img class="plogo" src="${p.logo_url || p.cover_url}" alt="${t('Logo de {n}', { n: p.name })}"><div><h1>${p.name}</h1>
      <div class="chips" style="margin-bottom:8px">${p.verified ? html`<span class="tag ok">${icon('check', 13)} ${t('Verificado')}</span>` : html`<span class="tag warn">${t('Perfil não verificado')}</span>`}${p.premium ? html`<span class="tag orange">★ Premium</span>` : ''} ${stars(p.rating, p.review_count)}</div>
      <div class="facts"><span>${icon('pin', 16)} ${p.neighborhood ? p.neighborhood + ' · ' : ''}${p.city}/${p.state}</span><span>${icon('clock', 16)} ${p.hours || t('Sob agendamento')}</span><span>${icon('cal', 16)} ${t('Antecedência mínima: {n} dia(s)', { n: p.min_notice_days })}</span></div></div>
      <div class="row"><button class="btn orange" data-act="quote-open" data-service="">${icon('chat', 18)} ${t('Conversar / pedir orçamento')}</button></div></div>
    <div class="stickytabs"><div class="in" role="navigation" aria-label="${t('Categorias do fornecedor')}">${d.categories.map((c, i) => html`<a href="#/f/${p.slug}" data-act="jump" data-to="cat-${c.slug}" aria-current="${i === 0}">${c.icon} ${c.name}</a>`)}<a href="#/f/${p.slug}" data-act="jump" data-to="sec-about">${t('Sobre')}</a><a href="#/f/${p.slug}" data-act="jump" data-to="sec-reviews">${t('Avaliações')}</a></div></div>
    <div class="layout right" style="margin-top:8px"><div>
      <section class="card pad" style="margin-top:18px"><h3>${icon('cal', 18)} ${t('Disponibilidade por data')}</h3>
        <form class="inline" data-form="check-date" data-slug="${p.slug}">${field(t('Consultar uma data'), 'date', { type: 'date', value: ctx.query.date || '', min: today() })}<button class="btn ghost" type="submit">${t('Verificar')}</button></form>
        ${d.availability.known ? (d.availability.available ? html`<div class="notice ok" role="status">✔ ${t('Disponível em {d}. A data é reservada quando o pagamento é confirmado.', { d: fmtDate(ctx.query.date) })}</div>` : html`<div class="notice bad" role="status">${t('Indisponível em {d}', { d: fmtDate(ctx.query.date) })}: ${d.availability.reason}.</div>`) : html`<p class="meta" style="margin:8px 0 0">${t('A disponibilidade é informativa até o pagamento ser confirmado.')}</p>`}</section>
      ${d.categories.map((c) => html`<section class="catsec" id="cat-${c.slug}"><h2>${c.icon} ${c.name}</h2><div class="grid">${c.services.map((s) => html`<article class="card svcrow" data-act="svc-open" data-id="${s.id}" tabindex="0" role="button" aria-label="${s.name}"><div>
          <h3>${s.name}</h3><p class="desc">${s.description || ''}</p><div class="row" style="gap:8px">${priceLabel(s)}<span class="tag ${priceKind(s.price_type)[1]}">${priceKind(s.price_type)[0]}</span></div>
          <p class="meta tiny" style="margin:6px 0 0">${s.min_qty > 1 ? t('Mínimo: {n}', { n: s.min_qty }) + ' · ' : ''}${t('Antecedência: {n} dia(s)', { n: s.lead_days })}${s.options.length ? ' · ' + t('{n} adicional(is)', { n: s.options.length }) : ''}</p></div>
          <div class="thumb"><img src="${s.images[0] || p.cover_url}" alt="${t('Imagem fictícia de {n}', { n: s.name })}" loading="lazy"><span class="addbtn" aria-hidden="true">${icon('plus', 20)}</span></div></article>`)}</div></section>`)}
      ${!d.categories.length ? empty('📦', t('Nenhum serviço publicado ainda'), t('Este fornecedor ainda não cadastrou itens no catálogo.')) : ''}
      <section class="catsec" id="sec-about"><h2>${t('Sobre')}</h2><div class="card pad"><p>${p.description}</p><div class="infogrid">
        <div><h3>${icon('pin', 16)} ${t('Endereço')}</h3>${p.address || p.city + '/' + p.state}</div><div><h3>${icon('clock', 16)} ${t('Horários')}</h3>${p.hours || t('Sob agendamento')}</div>
        <div><h3>${icon('globe', 16)} ${t('Área atendida')}</h3>${d.areas.join(', ') || p.city}</div><div><h3>${icon('arrow', 16)} ${t('Deslocamento')}</h3>${p.travel_policy || t('Consulte o fornecedor')}</div></div></div>
        <h3 style="margin-top:20px">${t('Portfólio')}</h3>${d.media.length ? html`<div class="gallery">${d.media.map((m) => m.type === 'imagem' ? html`<figure style="margin:0"><img src="${m.url}" alt="${m.caption || t('Foto do portfólio (fictícia)')}" loading="lazy"><figcaption class="meta tiny">${m.caption || ''}</figcaption></figure>` : html`<a class="card pad" href="${m.url}" target="_blank" rel="noopener noreferrer">🎬 ${m.caption || t('Ver vídeo')}<br><span class="meta tiny">${t('Abre em nova aba')}</span></a>`)}</div>` : html`<p class="meta">${t('Sem itens no portfólio.')}</p>`}</section>
      <section class="catsec" id="sec-reviews"><h2>${t('Avaliações')}</h2><p class="meta">${t('Somente clientes com contratações concluídas podem avaliar. Avaliações passam por moderação.')}</p>
        ${d.reviews.length ? html`<div class="card pad"><div class="revsum"><div><div class="big">${p.rating?.toFixed(1).replace('.', ',')}</div><div class="meta">${t('{n} avaliações', { n: p.review_count })}</div></div><div style="flex:1;min-width:200px">${[5, 4, 3, 2, 1].map((n) => html`<div class="row" style="gap:8px;flex-wrap:nowrap"><span class="meta" style="width:24px">${n}★</span><div class="bar" style="flex:1"><i style="width:${(hist[n - 1] / d.reviews.length) * 100}%"></i></div><span class="meta" style="width:22px">${hist[n - 1]}</span></div>`)}</div></div>
          ${d.reviews.map((r) => html`<div style="border-top:1px solid var(--line);padding:14px 0"><div class="row between"><strong>${r.author}</strong><span class="stars" aria-label="${t('Nota {r} de 5', { r: r.rating })}" style="color:#E08A00">${'★'.repeat(r.rating)}${'☆'.repeat(5 - r.rating)}</span></div><p style="margin:.3rem 0">${r.comment || ''}</p><span class="meta tiny">${fmtDate(r.created_at)}</span>${r.reply ? html`<div class="notice info"><strong>${t('Resposta do fornecedor')}:</strong> ${r.reply}</div>` : ''}</div>`)}</div>` : empty('⭐', t('Ainda sem avaliações'), t('As avaliações aparecem aqui após contratações concluídas.'))}</section>
    </div><aside><div class="card pad cartpanel" id="cartpanel">${cartPanel()}</div></aside></div></div></div>`;
});
act('jump', (el, e) => { e.preventDefault(); document.getElementById(el.dataset.to)?.scrollIntoView({ behavior: 'smooth' }); });
form('check-date', (d, f) => go(`#/f/${f.dataset.slug}?date=${d.date}`));
act('share', async () => { const url = location.href; try { if (navigator.share) await navigator.share({ title: P.provider.name, url }); else { await navigator.clipboard.writeText(url); toast(t('Link copiado!')); } track('provider_shared', { slug: P.provider.slug }); } catch { toast(t('Copie o endereço da barra do navegador para compartilhar.')); } });
act('fav', async (el) => {
  if (!state.user) return needLogin();
  const on = el.getAttribute('aria-pressed') === 'true';
  await api('/favorites/' + el.dataset.id, { method: on ? 'DELETE' : 'POST' });
  el.setAttribute('aria-pressed', String(!on)); toast(on ? t('Removido dos salvos.') : t('Fornecedor salvo!')); if (!on) track('provider_favorited', { id: el.dataset.id });
});
const findSvc = (id) => P.categories.flatMap((c) => c.services).find((s) => s.id === Number(id));
document.addEventListener('keydown', (e) => { if ((e.key === 'Enter' || e.key === ' ') && e.target.matches?.('.svcrow')) { e.preventDefault(); e.target.click(); } });

// detalhe do serviço: quantidade, adicionais e ações
act('svc-open', (el) => {
  const s = findSvc(el.dataset.id), p = P.provider; if (!s) return;
  track('service_viewed', { service: s.name, provider: p.name });
  openDialog(s.name, html`<form data-form="svc-add" data-id="${s.id}">
    <img src="${s.images[0] || p.cover_url}" alt="${t('Imagem fictícia de {n}', { n: s.name })}" style="border-radius:16px;margin-bottom:12px;max-height:250px;width:100%;object-fit:cover">
    <div class="row" style="margin-bottom:6px"><span class="tag ${priceKind(s.price_type)[1]}">${priceKind(s.price_type)[0]}</span>${priceLabel(s)}</div>
    <p>${s.description || ''}</p>
    <dl class="meta" style="margin:0 0 12px"><dt><strong>${t('O que está incluído')}</strong></dt><dd style="margin:0 0 8px">${s.includes || t('Consulte o fornecedor.')}</dd>
      <dt><strong>${t('Quantidade mínima e antecedência')}</strong></dt><dd style="margin:0 0 8px">${s.min_qty} ${s.unit} · ${t('{n} dia(s) de antecedência', { n: s.lead_days })}</dd>
      <dt><strong>${t('Entrega / deslocamento')}</strong></dt><dd style="margin:0 0 8px">${s.delivery_policy || p.travel_policy || '—'}</dd>
      <dt><strong>${t('Cancelamento')}</strong></dt><dd style="margin:0 0 8px">${s.cancel_policy || '—'}</dd></dl>
    ${s.price_type !== 'orcamento' ? html`${field(t('Quantidade ({u})', { u: s.unit }), 'qty', { type: 'number', value: s.min_qty, attrs: `min="${s.min_qty}" data-recalc`, required: true })}
      ${s.options.length ? html`<fieldset style="border:1px solid var(--line);border-radius:14px;margin:12px 0"><legend><strong>${t('Adicionais e personalização')}</strong></legend>${s.options.map((o) => html`<label class="check" style="padding:4px 0"><input type="checkbox" name="opt" value="${o.id}" data-price="${o.price_cents}" data-name="${o.name}" data-recalc> <span>${o.name} <strong>+ ${money(o.price_cents)}</strong></span></label>`)}</fieldset>` : ''}
      <p class="totals"><span class="total" data-est data-unit="${s.price_cents}">${t('Estimativa')}: ${money(s.price_cents * s.min_qty)}</span><small class="meta">${t('Estimativa. O valor final, com deslocamento e descontos, é calculado pelo sistema antes do pagamento.')}</small></p>`
    : html`<div class="notice info">${t('Este serviço é sob orçamento: informe os detalhes e o fornecedor envia uma proposta com valor, validade e condições.')}</div>`}
    ${errBox()}<div class="row">${s.price_type === 'orcamento' ? html`<button class="btn orange" type="button" data-act="quote-open" data-service="${s.id}">${t('Pedir orçamento')}</button>` : html`<button class="btn orange" type="submit">${icon('plus', 18)} ${t('Adicionar ao pedido')}</button>`}
    <button class="btn ghost" type="button" data-act="plan-open" data-id="${s.id}">${t('+ Planejamento')}</button></div></form>`);
});
document.addEventListener('input', (e) => {
  if (!e.target.matches('[data-recalc]')) return;
  const f = e.target.closest('form'), est = f.querySelector('[data-est]'); if (!est) return;
  const q = Math.max(1, Number(f.elements.qty.value) || 1), opts = [...f.querySelectorAll('input[name=opt]:checked')].reduce((s, o) => s + Number(o.dataset.price), 0);
  est.textContent = t('Estimativa') + ': ' + money(Number(est.dataset.unit) * q + opts);
});
const readSel = (f) => { const chk = [...f.querySelectorAll('input[name=opt]:checked')]; return { qty: Number(f.elements.qty?.value || 1), option_ids: chk.map((o) => Number(o.value)), opts_cents: chk.reduce((s, o) => s + Number(o.dataset.price), 0), opt_names: chk.map((o) => o.dataset.name).join(', ') }; };
form('svc-add', (d, f) => {
  const s = findSvc(f.dataset.id), sel = readSel(f), p = P.provider;
  if (state.cart && state.cart.provider_id !== p.id && state.cart.items.length && !confirm(t('Seu pedido atual é de outro fornecedor. Substituir por este?'))) return;
  const c = cartOf(p) || (state.cart = { provider_id: p.id, provider_slug: p.slug, provider_name: p.name, items: [], event_id: null });
  const item = { service_id: s.id, name: s.name, unit: s.unit, unit_cents: s.price_cents, ...sel };
  const ex = c.items.find((i) => i.service_id === s.id); if (ex) Object.assign(ex, item); else c.items.push(item);
  store.set('cart', state.cart); closeDialog(); refreshCart(); toast(t('Adicionado ao seu pedido!')); track('add_to_cart', { service: s.name, provider: p.name, qty: sel.qty });
});
act('cart-remove', (el) => { const c = cartOf(P.provider); c.items.splice(Number(el.dataset.n), 1); store.set('cart', state.cart); refreshCart(); });

// adicionar ao planejamento (evento)
act('plan-open', async (el) => {
  if (!state.user) return needLogin();
  const s = findSvc(el.dataset.id), f = document.querySelector('#dialog form'), sel = f && f.elements.qty ? readSel(f) : { qty: s.min_qty, option_ids: [] };
  const evs = await api('/events');
  openDialog(t('Adicionar ao planejamento'), html`<p><strong>${s.name}</strong> × ${sel.qty}</p><form class="grid" data-form="plan-add" data-id="${s.id}" data-qty="${sel.qty}" data-opts="${sel.option_ids.join(',')}">
    ${evs.length ? field(t('Em qual festa?'), 'event_id', { type: 'select', options: [...evs.map((e) => [e.id, `${e.name}${e.date ? ' · ' + fmtDate(e.date) : ''}`]), ['new', t('+ Criar nova festa')]] }) : html`<input type="hidden" name="event_id" value="new"><p class="notice info">${t('Você ainda não tem festas. Vamos criar a primeira!')}</p>`}
    <div data-newevent ${evs.length ? 'hidden' : ''} class="grid">${field(t('Nome da nova festa'), 'name', { placeholder: t('Ex.: Aniversário da Bia') })}${field(t('Data (opcional)'), 'date', { type: 'date', min: today() })}</div>${errBox()}<button class="btn" type="submit">${t('Adicionar')}</button></form>`);
});
form('plan-add', async (d, f) => {
  let eid = d.event_id;
  if (eid === 'new') { if (!d.name) throw new Error(t('Dê um nome para a nova festa.')); eid = (await api('/events', { method: 'POST', body: { name: d.name, date: d.date || null, type: null } })).id; }
  await api(`/events/${eid}/items`, { method: 'POST', body: { service_id: Number(f.dataset.id), qty: Number(f.dataset.qty), option_ids: f.dataset.opts ? f.dataset.opts.split(',').map(Number) : [] } });
  closeDialog(); toast(t('Adicionado ao planejamento!')); track('added_to_plan', { event_id: eid }); go('#/eventos/' + eid);
});

// solicitar orçamento
act('quote-open', async (el) => {
  if (!state.user) return needLogin();
  const p = P.provider, s = el.dataset.service ? findSvc(el.dataset.service) : null, evs = await api('/events');
  openDialog(s ? t('Orçamento: {n}', { n: s.name }) : t('Falar com {n}', { n: p.name }), html`<form class="grid" data-form="quote" data-provider="${p.id}" data-service="${s?.id || ''}">
    <p class="meta">${t('O fornecedor responde com uma proposta detalhada (valor, validade e condições). Você também pode conversar por mensagem.')}</p>
    ${evs.length ? field(t('Vincular a uma festa (opcional)'), 'event_id', { type: 'select', options: [['', t('Nenhuma')], ...evs.map((e) => [e.id, e.name])] }) : ''}
    <div class="cols">${field(t('Data do evento'), 'date', { type: 'date', min: today(), required: true, value: new URLSearchParams(location.hash.split('?')[1] || '').get('date') || '' })}${field(t('Duração'), 'duration', { placeholder: t('Ex.: 4 horas') })}${field(t('Nº de convidados'), 'guests', { type: 'number', value: store.get('guests') || '', attrs: 'min="1"' })}</div>
    ${field(t('Local do evento (endereço)'), 'location', { required: true, placeholder: t('Rua, número, bairro') })}
    ${field(t('Cidade'), 'city', { type: 'select', value: p.city, options: (state.config.cities || []).map((c) => [c.name, `${c.name}/${c.state}`]) })}
    ${field(t('Observações'), 'notes', { type: 'textarea', placeholder: t('Conte detalhes: tema, referências, restrições…') })}${errBox()}<button class="btn orange" type="submit">${t('Enviar solicitação')}</button></form>`);
});
form('quote', async (d, f) => {
  const r = await api('/quotes', { method: 'POST', body: { provider_id: Number(f.dataset.provider), service_id: f.dataset.service ? Number(f.dataset.service) : null, event_id: d.event_id ? Number(d.event_id) : null, date: d.date, duration: d.duration, guests: d.guests ? Number(d.guests) : null, location: d.location, city: d.city, notes: d.notes } });
  track('quote_requested', { provider: P.provider.name });
  closeDialog(); toast(r.availability?.available === false ? t('Solicitação enviada. Atenção: a data pode estar indisponível.') : t('Solicitação enviada! Você será avisado quando houver proposta.')); go('#/orcamentos/' + r.id);
});

// ---------------- autenticação ----------------
route('/entrar', (ctx) => {
  ctx.title = t('Entrar');
  return html`<div class="wrap page" style="max-width:480px"><h1>${t('Entrar')}</h1><form class="card pad grid" data-form="login" data-next="${ctx.query.next || '/'}">${field(t('E-mail'), 'email', { type: 'email', required: true, autocomplete: 'email' })}${field(t('Senha'), 'password', { type: 'password', required: true, autocomplete: 'current-password' })}${errBox()}<button class="btn" type="submit">${t('Entrar')}</button><p class="meta">${t('Não tem conta?')} <a href="#/cadastro">${t('Criar conta grátis')}</a></p></form>
  <div class="notice info" style="margin-top:14px"><strong>${t('Contas de demonstração')}</strong> (${t('senha')} <code>agitae123</code>):<br>${t('Cliente')}: cliente@agitae.test<br>${t('Fornecedor')}: doce-sabor-confeitaria@agitae.test · mariana-teixeira-fotografia@agitae.test<br>${t('Administrador')}: admin@agitae.test</div></div>`;
});
form('login', async (d, f) => { await api('/auth/login', { method: 'POST', body: d }); track('login'); window.dispatchEvent(new Event('agitae:user')); await new Promise((r) => setTimeout(r, 150)); go('#' + f.dataset.next); });
route('/cadastro', (ctx) => {
  ctx.title = t('Criar conta');
  return html`<div class="wrap page" style="max-width:480px"><h1>${t('Criar conta')}</h1><form class="card pad grid" data-form="register">${field(t('Nome completo'), 'name', { required: true, autocomplete: 'name' })}${field(t('E-mail'), 'email', { type: 'email', required: true, autocomplete: 'email' })}${field(t('Telefone (opcional)'), 'phone', { type: 'tel', autocomplete: 'tel' })}${field(t('Senha'), 'password', { type: 'password', required: true, hint: t('Mínimo de 8 caracteres.'), autocomplete: 'new-password', attrs: 'minlength="8"' })}
  <label class="check"><input type="checkbox" name="consent" required> <span>${t('Li e aceito a')} <a href="#/privacidade" target="_blank">${t('Política de Privacidade')}</a>.</span></label>${errBox()}<button class="btn" type="submit">${t('Criar conta')}</button><p class="meta">${t('Já tem conta?')} <a href="#/entrar">${t('Entrar')}</a> · ${t('Quer vender serviços?')} <a href="#/fornecedor/cadastro">${t('Cadastro de fornecedor')}</a></p></form></div>`;
});
form('register', async (d, f) => { await api('/auth/register', { method: 'POST', body: { ...d, consent: f.elements.consent.checked } }); track('signup'); window.dispatchEvent(new Event('agitae:user')); toast(t('Conta criada! Bem-vindo(a) à Agitaê.')); await new Promise((r) => setTimeout(r, 150)); go('#/'); });

route('/privacidade', (ctx) => {
  ctx.title = t('Política de Privacidade');
  return html`<div class="wrap page" style="max-width:820px"><h1>${t('Política de Privacidade')}</h1><p class="notice">${t('Modelo de política alinhado à LGPD (Lei 13.709/2018). Revise com assessoria jurídica e preencha os dados do controlador antes de publicar.')}</p>
  <h2>${t('Quais dados coletamos')}</h2><p>${t('Nome, e-mail, telefone (opcional), dados dos eventos que você cria, pedidos, mensagens e avaliações. Não armazenamos dados de cartão: pagamentos são processados pelo provedor de pagamentos.')}</p>
  <h2>${t('Para que usamos')}</h2><p>${t('Para criar sua conta, mostrar fornecedores da sua região, processar pedidos e pagamentos, enviar notificações do pedido e prevenir fraudes. A localização do dispositivo só é usada se você permitir, e apenas para buscar fornecedores próximos.')}</p>
  <h2>${t('Análise de uso')}</h2><p>${t('Podemos usar uma ferramenta de análise de produto (como o Pendo) para entender como o site é usado e melhorá-lo. Nesse caso, enviamos eventos de navegação e um identificador interno do usuário, sem nome nem e-mail.')}</p>
  <h2>${t('Com quem compartilhamos')}</h2><p>${t('O fornecedor que você contrata recebe apenas os dados necessários para atender o pedido (nome, data, local, mensagens). Convidados de um evento veem somente o convite — nunca pedidos, valores ou pagamentos.')}</p>
  <h2>${t('Por quanto tempo guardamos')}</h2><p>${t('Dados da conta: enquanto ela existir. Dados fiscais e financeiros de pedidos: 5 anos, por obrigação legal. Após excluir a conta, dados pessoais são anonimizados.')}</p>
  <h2>${t('Seus direitos')}</h2><p>${t('Você pode acessar, corrigir, exportar (JSON) e excluir seus dados em Minha conta. Dúvidas: privacidade@agitae.com.br (defina o contato do encarregado antes de publicar).')}</p>
  <h2>${t('Cookies')}</h2><p>${t('Usamos apenas um cookie de sessão essencial para manter você conectado.')}</p></div>`;
});

// ---------------- convite público ----------------
route('/convite/:token', async (ctx) => {
  const i = await api('/invites/' + ctx.params.token); ctx.title = i.title;
  return html`<div class="wrap page" style="max-width:580px;text-align:center"><div class="card pad"><div style="font-size:3.4rem" aria-hidden="true">🎉</div><h1>${i.title}</h1><p>${i.message || ''}</p><p><strong>${i.name}</strong><br>${i.date ? fmtDate(i.date) : t('Data a confirmar')}${i.city ? ' · ' + i.city : ''}${i.address ? html`<br>${i.address}` : ''}</p>
  <form class="grid" style="text-align:left" data-form="rsvp" data-token="${ctx.params.token}"><h2>${t('Confirme sua presença')}</h2>${field(t('Seu nome'), 'name', { required: true })}${field(t('Você vai?'), 'status', { type: 'select', options: [['vou', t('Sim, eu vou! 🎉')], ['talvez', t('Talvez')], ['nao_vou', t('Não poderei ir')]] })}${field(t('Acompanhantes'), 'companions', { type: 'number', value: 0, attrs: 'min="0" max="20"' })}${errBox()}<button class="btn orange" type="submit">${t('Enviar resposta')}</button></form></div></div>`;
});
form('rsvp', async (d, f) => { await api(`/invites/${f.dataset.token}/rsvp`, { method: 'POST', body: { ...d, companions: Number(d.companions || 0) } }); f.innerHTML = `<div class="notice ok" role="status"><strong>${t('Resposta enviada!')}</strong> ${t('Obrigado por confirmar.')}</div>`; });

import { api, state, html, raw, esc, route, act, form, field, empty, stars, money, fmtDate, priceLabel, priceKind, EVENT_TYPE, store, toast, go, openDialog, closeDialog, errBox, needLogin, back, toCents } from './core.js';

const today = () => state.config?.today || new Date().toISOString().slice(0, 10);
const cats = () => state.config?.categories || [];
const catBySlug = (s) => cats().find((c) => c.slug === s);

// ---------------- localização ----------------
const savedLoc = () => store.get('loc') || {};
function locField(prefix = '', value = '') {
  const s = savedLoc();
  return html`<div class="field"><label for="${prefix}loc">Onde será a festa? <span class="meta">(CEP, cidade ou bairro)</span></label>
    <div class="inline"><input id="${prefix}loc" name="loc" value="${value || s.q || ''}" placeholder="Ex.: 01310-100, Rio de Janeiro ou Mooca" autocomplete="postal-code" data-locinput>
    <button class="btn ghost" type="button" data-act="geo" title="Usar a localização do dispositivo (o navegador pedirá sua permissão)">📍 <span>Usar minha localização</span></button></div>
    <input type="hidden" name="lat" value="${s.lat && !value ? s.lat : ''}" data-lat><input type="hidden" name="lng" value="${s.lng && !value ? s.lng : ''}" data-lng></div>`;
}
document.addEventListener('input', (e) => { if (e.target.matches('[data-locinput]')) { const f = e.target.closest('form'); f.querySelector('[data-lat]').value = ''; f.querySelector('[data-lng]').value = ''; } });
act('geo', (el) => new Promise((resolve) => {
  const f = el.closest('form');
  if (!navigator.geolocation) { toast('Seu navegador não oferece localização. Digite o CEP ou a cidade.', true); return resolve(); }
  toast('Aguardando sua permissão para usar a localização…');
  navigator.geolocation.getCurrentPosition(async (pos) => {
    try {
      const { location } = await api(`/locations/resolve?lat=${pos.coords.latitude}&lng=${pos.coords.longitude}`);
      f.querySelector('[data-locinput]').value = location?.label || 'Minha localização';
      f.querySelector('[data-lat]').value = pos.coords.latitude.toFixed(4); f.querySelector('[data-lng]').value = pos.coords.longitude.toFixed(4);
      toast('Localização definida: ' + (location?.label || 'sua região'));
    } catch (e) { toast(e.message, true); }
    resolve();
  }, () => { toast('Sem permissão de localização. Você pode digitar o CEP, a cidade ou o bairro.', true); resolve(); }, { timeout: 10000 });
}));
function saveLoc(d) { if (d.loc || d.lat) store.set('loc', { q: d.loc, lat: d.lat, lng: d.lng }); }
act('clear-loc', () => { store.del('loc'); go('#/'); location.reload(); });

// ---------------- cartões ----------------
export function providerCard(p, date) {
  const av = p.availability || {};
  return html`<a class="card pcard" href="#/f/${p.slug}${date ? '?date=' + date : ''}">
    <img class="cover" src="${p.cover_url}" alt="Imagem de capa (fictícia) de ${p.name}" loading="lazy">
    <div class="body">
      <div class="row between"><h3>${p.name}</h3>${stars(p.rating, p.review_count)}</div>
      <div class="chips">${p.verified ? html`<span class="tag ok">✔ Verificado</span>` : ''}${p.premium ? html`<span class="tag orange">★ Premium</span>` : ''}${av.known ? (av.available ? html`<span class="tag ok">Disponível em ${fmtDate(date)}</span>` : html`<span class="tag bad">Indisponível: ${av.reason}</span>`) : ''}</div>
      <div class="meta">📍 ${p.city}/${p.state} · ${p.area}</div>
      <div class="chips">${p.categories.slice(0, 4).map((c) => html`<span class="chip">${c}</span>`)}</div>
      <div style="margin-top:auto"><div class="meta">Destaque: ${p.featured.name}</div>${p.from_price_cents != null ? html`<span class="price"><small>a partir de</small> ${money(p.from_price_cents)}</span>` : html`<span class="price">Sob orçamento</span>`}</div>
    </div></a>`;
}

// ---------------- home ----------------
route('/', async (ctx) => {
  const s = savedLoc();
  const qs = s.lat ? `lat=${s.lat}&lng=${s.lng}` : s.q ? `loc=${encodeURIComponent(s.q)}` : '';
  const [near, popular] = await Promise.all([api('/search?' + qs), s.q || s.lat ? api('/search') : Promise.resolve(null)]);
  const base = popular || near;
  const svcs = base.results.slice(0, 8);
  const banners = state.config?.banners || [];
  ctx.title = 'Organize sua festa de forma rápida e fácil';
  return html`<section class="hero"><div class="wrap">
    <h1>Organize sua festa de forma rápida e fácil.</h1>
    <p class="lead">Informe onde e quando será, compare fornecedores da sua região e contrate tudo em um só lugar.</p>
    <form class="searchbox" data-form="search" role="search" aria-label="Buscar serviços para festa">
      <div class="field c-q"><label for="q">O que você precisa para a sua festa?</label><input id="q" name="q" placeholder="Ex.: bolo, fotógrafo, buffet, DJ…" autocomplete="off"></div>
      <div class="c-l">${locField()}</div>
      ${field('Data do evento', 'date', { type: 'date', min: today(), cls: 'c-s' })}
      ${field('Tipo de festa', 'event_type', { type: 'select', cls: 'c-s', options: [['', 'Qualquer'], ...Object.entries(EVENT_TYPE)] })}
      ${field('Convidados', 'guests', { type: 'number', attrs: 'min="1" inputmode="numeric"', cls: 'c-s', placeholder: 'Ex.: 50' })}
      <div class="c-go" style="display:flex;align-items:flex-end"><button class="btn orange" style="width:100%" type="submit">Buscar fornecedores</button></div>
      <p class="meta" style="grid-column:1/-1;margin:0">Você pode explorar sem preencher tudo. Data e localização ajudam a mostrar só quem atende você.</p>
    </form></div></section>
  <div class="wrap page" style="padding-top:8px">
    ${banners.map((b) => html`<div class="banner"><strong>${b.title}</strong> ${b.text || ''} ${b.link ? html`<a href="${b.link}">Saiba mais →</a>` : ''}</div>`)}
    <section class="section"><h2>Categorias</h2><div class="cats">${cats().map((c) => html`<a class="cat" href="#/categoria/${c.slug}"><span class="i" aria-hidden="true">${c.icon}</span>${c.name}</a>`)}</div></section>
    <section class="section"><div class="row between"><h2>${s.q || s.lat ? 'Fornecedores próximos de você' : 'Fornecedores em destaque'}</h2>${s.q || s.lat ? html`<span class="meta">📍 ${s.q || 'Sua localização'} · <button class="btn ghost sm" data-act="clear-loc">Trocar</button></span>` : ''}</div>
      ${!(s.q || s.lat) ? html`<div class="notice info">Informe sua localização acima para ver só quem atende a sua região.</div>` : ''}
      ${near.results.length ? html`<div class="grid g2">${near.results.slice(0, 6).map((p) => providerCard(p))}</div>` : emptyRegion(near, s.q)}</section>
    <section class="section"><h2>Serviços populares</h2><div class="grid g3">${svcs.map((p) => html`<a class="card pcard" href="#/f/${p.slug}"><img class="cover" src="${p.featured.image || p.cover_url}" alt="Imagem fictícia de ${p.featured.name}" loading="lazy"><div class="body"><strong>${p.featured.name}</strong><span class="meta">${p.name} · ${p.city}</span>${priceLabel(p.featured)}</div></a>`)}</div></section>
    <section class="section"><h2>Sugestões para começar a planejar</h2><div class="grid g3">
      ${[['🎂', 'Aniversário', ['doces-salgados', 'bolos', 'decoracao', 'fotografia']], ['🎈', 'Festa infantil', ['recreacao-infantil', 'brinquedos', 'decoracao', 'bolos']], ['💍', 'Casamento', ['espaco-eventos', 'buffet', 'cerimonial', 'flores']], ['🎓', 'Formatura', ['buffet', 'dj-musica', 'fotografia', 'iluminacao-som']]].map(([i, t, cs]) => html`<div class="card pad"><h3>${i} ${t}</h3><p class="meta">Comece por estas categorias:</p><div class="chips">${cs.map((c) => html`<a class="chip" href="#/categoria/${c}">${catBySlug(c)?.name || c}</a>`)}</div></div>`)}</div>
      <p><a class="btn ghost" href="#/eventos">Criar minha festa e montar o planejamento</a></p></section>
    <section class="section"><h2>Como funciona</h2><div class="steps">
      <div class="step"><b>1</b><h3>Organize</h3><p>Diga onde, quando e que tipo de festa você quer fazer.</p></div>
      <div class="step"><b>2</b><h3>Encontre</h3><p>Compare fornecedores da sua região, preços e avaliações.</p></div>
      <div class="step"><b>3</b><h3>Agende</h3><p>Peça orçamento ou contrate. A data é reservada após o pagamento.</p></div>
      <div class="step"><b>4</b><h3>Realize</h3><p>Acompanhe o pedido, converse com o fornecedor e curta a festa.</p></div></div></section>
  </div>`;
});
function emptyRegion(res, q) {
  if (res.empty_reason === 'local_desconhecido') return empty('🗺️', 'Não reconhecemos esse local', 'Tente um CEP completo, o nome da cidade ou o bairro.');
  return empty('🚧', 'Ainda não chegamos por aí', `Ainda não temos fornecedores${q ? ' para "' + q + '"' : ' nesta região'}. Já atendemos: ${(res.other_cities || []).map((c) => c.name).join(', ') || 'algumas cidades'}.`, html`<a class="btn ghost" href="#/fornecedor/cadastro">Conhece um fornecedor? Indique o cadastro</a>`);
}
form('search', (d, f) => {
  saveLoc(d);
  const p = new URLSearchParams(); for (const [k, v] of Object.entries(d)) if (v !== '' && v != null && !(k === 'guests')) p.set(k, v);
  if (d.guests) store.set('guests', d.guests);
  go('#/busca?' + p);
});

// ---------------- busca / categoria ----------------
async function searchPage(ctx) {
  const q = { ...ctx.query }; if (ctx.params.slug) q.category = ctx.params.slug;
  const c = q.category ? catBySlug(q.category) : null;
  const usp = new URLSearchParams(); for (const k of ['q', 'loc', 'lat', 'lng', 'category', 'date', 'event_type', 'min_price', 'max_price', 'min_rating', 'available', 'sort']) if (q[k]) usp.set(k, q[k]);
  if (!q.loc && !q.lat && savedLoc().q && !('nolocation' in q)) { const s = savedLoc(); if (s.lat) { usp.set('lat', s.lat); usp.set('lng', s.lng); q.lat = s.lat; q.lng = s.lng; q.loc = s.q; } else if (s.q) { usp.set('loc', s.q); q.loc = s.q; } }
  const res = await api('/search?' + usp);
  ctx.title = c ? c.name : 'Buscar fornecedores';
  const back = `#/${ctx.params.slug ? 'categoria/' + ctx.params.slug : 'busca'}`;
  return html`<div class="wrap page"><h1>${c ? html`<span aria-hidden="true">${c.icon}</span> ${c.name}` : 'Buscar fornecedores'}</h1>
    <p class="meta" role="status">${res.total} fornecedor(es)${res.location ? html` · 📍 ${res.location.label}` : ' · todas as regiões'}${q.date ? html` · ${fmtDate(q.date)}` : ''}</p>
    <div class="layout"><form class="card pad filters" data-form="refine" data-base="${back}" aria-label="Filtros">
      <h2>Filtros</h2>
      ${field('Buscar', 'q', { value: q.q, placeholder: 'nome, serviço, palavra-chave' })}
      ${field('Categoria', 'category', { type: 'select', value: q.category || '', options: [['', 'Todas'], ...cats().map((x) => [x.slug, x.name])] })}
      ${locField('r-', q.loc || '')}
      ${field('Data do evento', 'date', { type: 'date', value: q.date, min: today() })}
      <label class="check"><input type="checkbox" name="available" value="1" ${q.available ? 'checked' : ''}> <span>Só fornecedores disponíveis na data</span></label>
      ${field('Tipo de festa', 'event_type', { type: 'select', value: q.event_type || '', options: [['', 'Qualquer'], ...Object.entries(EVENT_TYPE)] })}
      <div class="inline">${field('Preço mín. (R$)', 'min_price', { type: 'number', value: q.min_price, attrs: 'min="0" step="1"' })}${field('Preço máx. (R$)', 'max_price', { type: 'number', value: q.max_price, attrs: 'min="0" step="1"' })}</div>
      ${field('Avaliação mínima', 'min_rating', { type: 'select', value: q.min_rating || '', options: [['', 'Qualquer'], ['3', '3★ ou mais'], ['4', '4★ ou mais'], ['4.5', '4,5★ ou mais']] })}
      ${field('Ordenar por', 'sort', { type: 'select', value: q.sort || 'relevancia', options: [['relevancia', 'Relevância'], ['preco_asc', 'Menor preço'], ['preco_desc', 'Maior preço'], ['avaliacao', 'Melhor avaliação']] })}
      <button class="btn" type="submit">Aplicar filtros</button>
      <p class="meta">Tipos de preço: <span class="tag ok">Preço fechado</span> <span class="tag info">A partir de</span> <span class="tag orange">Sob orçamento</span></p>
    </form>
    <div>${res.results.length ? html`<div class="grid g2">${res.results.map((p) => providerCard(p, q.date))}</div>` : emptyResults(res, q)}</div></div></div>`;
}
function emptyResults(res, q) {
  if (res.empty_reason === 'sem_resultados') return empty('🔎', 'Nada encontrado', 'Tente outros termos ou remova alguns filtros.');
  return emptyRegion(res, q.loc);
}
form('refine', (d) => { saveLoc(d); const p = new URLSearchParams(); for (const [k, v] of Object.entries(d)) if (v !== '' && v != null) p.set(k, v); if (!d.loc && !d.lat) p.set('nolocation', '1'); go('#/busca?' + p); });
route('/busca', searchPage); route('/categoria/:slug', searchPage);

// ---------------- perfil do fornecedor ----------------
let P = null; // dados da página atual
route('/f/:slug', async (ctx) => {
  const d = (P = await api(`/providers/${ctx.params.slug}${ctx.query.date ? '?date=' + ctx.query.date : ''}`));
  const p = d.provider, unav = (await api(`/providers/${p.slug}/unavailable`).catch(() => ({ dates: [] })));
  ctx.title = p.name; P.unav = unav;
  const allSvcs = d.categories.flatMap((c) => c.services);
  return html`<div class="wrap page">
    ${p.status !== 'aprovado' ? html`<div class="notice">Este perfil está <strong>${p.status}</strong> e só é visível para você e a administração.</div>` : ''}
    <img class="cover-big" src="${p.cover_url}" alt="Capa (fictícia) de ${p.name}">
    <div class="pheader"><img class="logo-img" src="${p.logo_url || p.cover_url}" alt="Logo de ${p.name}"><div><h1 style="margin:0">${p.name}</h1><div class="chips">${p.verified ? html`<span class="tag ok">✔ Verificado</span>` : html`<span class="tag warn">Perfil não verificado</span>`}${p.premium ? html`<span class="tag orange">★ Premium</span>` : ''} ${stars(p.rating, p.review_count)}</div></div></div>
    <div class="row" style="margin:16px 0">
      <button class="btn ghost sm" data-act="fav" data-id="${p.id}" aria-pressed="${d.favorite}">${d.favorite ? '♥ Salvo' : '♡ Salvar'}</button>
      <button class="btn ghost sm" data-act="share">↗ Compartilhar</button>
      <button class="btn orange sm" data-act="quote-open" data-service="">💬 Conversar / pedir orçamento</button></div>
    <div class="layout right"><div>
      <section><h2>Sobre</h2><p>${p.description}</p><div class="cols">
        <div><strong>📍 Endereço</strong><br>${p.address || p.city + '/' + p.state}</div><div><strong>🕒 Horários</strong><br>${p.hours || 'Sob agendamento'}</div>
        <div><strong>🗺️ Área atendida</strong><br>${d.areas.join(', ') || p.city}</div><div><strong>🚚 Deslocamento</strong><br>${p.travel_policy || 'Consulte o fornecedor'}</div></div></section>
      <section class="section" aria-labelledby="dispo"><h2 id="dispo">Disponibilidade por data</h2>
        <form class="inline" data-form="check-date" data-slug="${p.slug}">${field('Consultar uma data', 'date', { type: 'date', value: ctx.query.date || '', min: today() })}<button class="btn ghost" type="submit">Verificar</button></form>
        ${d.availability.known ? (d.availability.available ? html`<div class="notice ok" role="status">✔ Disponível em ${fmtDate(ctx.query.date)}. A data é reservada quando o pagamento é confirmado.</div>` : html`<div class="notice bad" role="status">Indisponível em ${fmtDate(ctx.query.date)}: ${d.availability.reason}.</div>`) : html`<p class="meta">Antecedência mínima: ${p.min_notice_days} dia(s). A disponibilidade é informativa até o pagamento ser confirmado.</p>`}</section>
      <section class="section"><h2>Catálogo de serviços e produtos</h2>
        <div class="tabs" role="navigation" aria-label="Categorias do fornecedor">${d.categories.map((c) => html`<a href="#/f/${p.slug}" data-act="jump" data-to="cat-${c.slug}">${c.icon} ${c.name} (${c.services.length})</a>`)}</div>
        ${d.categories.map((c) => html`<div id="cat-${c.slug}" style="scroll-margin-top:90px"><h3>${c.icon} ${c.name}</h3><div class="grid">${c.services.map((s) => html`<article class="card svc"><img src="${s.images[0] || p.cover_url}" alt="Imagem fictícia de ${s.name}" loading="lazy"><div>
          <div class="row between"><strong>${s.name}</strong><span class="tag ${priceKind(s.price_type)[1]}">${priceKind(s.price_type)[0]}</span></div>${priceLabel(s)}
          <p class="meta" style="margin:.25rem 0">${s.description || ''}</p>
          <p class="meta" style="margin:0">${s.min_qty > 1 ? `Mínimo: ${s.min_qty} · ` : ''}Antecedência: ${s.lead_days} dia(s)${s.options.length ? ` · ${s.options.length} adicional(is)` : ''}</p>
          <div class="row" style="margin-top:8px"><button class="btn sm" data-act="svc-open" data-id="${s.id}">Ver detalhes</button>
            ${s.price_type === 'orcamento' ? html`<button class="btn orange sm" data-act="quote-open" data-service="${s.id}">Pedir orçamento</button>` : html`<button class="btn orange sm" data-act="hire-open" data-id="${s.id}">Contratar</button>`}
            <button class="btn ghost sm" data-act="plan-open" data-id="${s.id}">+ Planejamento</button></div></div></article>`)}</div></div>`)}
        ${!allSvcs.length ? empty('📦', 'Nenhum serviço publicado ainda', 'Este fornecedor ainda não cadastrou itens no catálogo.') : ''}</section>
      <section class="section"><h2>Portfólio</h2>${d.media.length ? html`<div class="gallery">${d.media.map((m) => m.type === 'imagem' ? html`<figure style="margin:0"><img src="${m.url}" alt="${m.caption || 'Foto do portfólio (fictícia)'}" loading="lazy"><figcaption class="meta">${m.caption || ''}</figcaption></figure>` : html`<a class="card pad" href="${m.url}" target="_blank" rel="noopener noreferrer">🎬 ${m.caption || 'Ver vídeo'}<br><span class="meta">Abre em nova aba</span></a>`)}</div>` : html`<p class="meta">Sem itens no portfólio.</p>`}</section>
      <section class="section"><h2>Avaliações</h2><p class="meta">Somente clientes com contratações concluídas podem avaliar. Avaliações passam por moderação.</p>${d.reviews.length ? d.reviews.map((r) => html`<div class="card pad" style="margin-bottom:10px"><div class="row between"><strong>${r.author}</strong><span class="stars" aria-label="Nota ${r.rating} de 5">${'★'.repeat(r.rating)}${'☆'.repeat(5 - r.rating)}</span></div><p>${r.comment || ''}</p><span class="meta">${fmtDate(r.created_at)}</span>${r.reply ? html`<div class="notice info"><strong>Resposta do fornecedor:</strong> ${r.reply}</div>` : ''}</div>`) : empty('⭐', 'Ainda sem avaliações', 'As avaliações aparecem aqui após contratações concluídas.')}</section>
    </div>
    <aside class="card pad" style="align-self:start;position:sticky;top:80px"><h3>Contratar com segurança</h3><ul class="meta" style="padding-left:18px"><li>Preços e taxas claros antes de pagar</li><li>Pagamento pela plataforma</li><li>Data reservada após confirmação</li><li>Cancelamento: reembolso de 100% até 7 dias antes; 50% de 2 a 6 dias</li></ul>
      <button class="btn orange" style="width:100%" data-act="quote-open" data-service="">Pedir orçamento</button></aside></div></div>`;
});
act('jump', (el, e) => { e.preventDefault(); document.getElementById(el.dataset.to)?.scrollIntoView({ behavior: 'smooth' }); });
form('check-date', (d, f) => go(`#/f/${f.dataset.slug}?date=${d.date}`));
act('share', async () => { const url = location.href; try { if (navigator.share) await navigator.share({ title: P.provider.name, url }); else { await navigator.clipboard.writeText(url); toast('Link copiado!'); } } catch { toast('Copie o endereço da barra do navegador para compartilhar.'); } });
act('fav', async (el) => {
  if (!state.user) return needLogin();
  const on = el.getAttribute('aria-pressed') === 'true';
  await api('/favorites/' + el.dataset.id, { method: on ? 'DELETE' : 'POST' });
  el.setAttribute('aria-pressed', String(!on)); el.textContent = on ? '♡ Salvar' : '♥ Salvo'; toast(on ? 'Removido dos salvos.' : 'Fornecedor salvo!');
});
const findSvc = (id) => P.categories.flatMap((c) => c.services).find((s) => s.id === Number(id));

// detalhe do serviço + seleção de quantidade/adicionais
function svcDialog(s, mode) {
  const p = P.provider;
  openDialog(s.name, html`<form data-form="svc-${mode}" data-id="${s.id}">
    <img src="${s.images[0] || p.cover_url}" alt="Imagem fictícia de ${s.name}" style="border-radius:12px;margin-bottom:10px;max-height:240px;width:100%;object-fit:cover">
    <div class="row"><span class="tag ${priceKind(s.price_type)[1]}">${priceKind(s.price_type)[0]}</span>${priceLabel(s)}</div>
    <p>${s.description || ''}</p>
    <dl class="meta" style="margin:0 0 12px"><dt><strong>O que está incluído</strong></dt><dd style="margin:0 0 6px">${s.includes || 'Consulte o fornecedor.'}</dd>
      <dt><strong>Quantidade mínima / antecedência</strong></dt><dd style="margin:0 0 6px">${s.min_qty} ${s.unit}(s) · ${s.lead_days} dia(s) de antecedência</dd>
      <dt><strong>Entrega / deslocamento</strong></dt><dd style="margin:0 0 6px">${s.delivery_policy || p.travel_policy || '—'}</dd>
      <dt><strong>Cancelamento</strong></dt><dd style="margin:0 0 6px">${s.cancel_policy || '—'}</dd></dl>
    ${s.price_type !== 'orcamento' ? html`${field('Quantidade (' + s.unit + ')', 'qty', { type: 'number', value: s.min_qty, attrs: `min="${s.min_qty}" data-recalc`, required: true })}
      ${s.options.length ? html`<fieldset style="border:1px solid var(--line);border-radius:10px;margin:10px 0"><legend><strong>Adicionais e personalização</strong></legend>${s.options.map((o) => html`<label class="check"><input type="checkbox" name="opt" value="${o.id}" data-price="${o.price_cents}" data-recalc> <span>${o.name} <strong>+ ${money(o.price_cents)}</strong></span></label>`)}</fieldset>` : ''}
      <p class="totals"><span class="total" data-est data-unit="${s.price_cents}">Estimativa: ${money(s.price_cents * s.min_qty)}</span><small class="meta">Estimativa. O valor final, com deslocamento e descontos, é calculado pelo sistema antes do pagamento.</small></p>` : html`<div class="notice info">Este serviço é sob orçamento: informe os detalhes e o fornecedor envia uma proposta com valor, validade e condições.</div>`}
    ${errBox()}<div class="row">${mode === 'hire' ? html`<button class="btn orange" type="submit">Continuar para a contratação</button>` : mode === 'plan' ? html`<button class="btn" type="submit">Escolher evento</button>` : s.price_type === 'orcamento' ? html`<button class="btn orange" type="button" data-act="quote-open" data-service="${s.id}">Pedir orçamento</button>` : html`<button class="btn orange" type="submit">Contratar</button>`}
    ${mode === 'view' ? html`<button class="btn ghost" type="button" data-act="plan-open" data-id="${s.id}">+ Planejamento</button>` : ''}</div></form>`);
}
document.addEventListener('input', (e) => {
  if (!e.target.matches('[data-recalc]')) return;
  const f = e.target.closest('form'), est = f.querySelector('[data-est]'); if (!est) return;
  const q = Math.max(1, Number(f.elements.qty.value) || 1), opts = [...f.querySelectorAll('input[name=opt]:checked')].reduce((t, o) => t + Number(o.dataset.price), 0);
  est.textContent = 'Estimativa: ' + money(Number(est.dataset.unit) * q + opts);
});
act('svc-open', (el) => svcDialog(findSvc(el.dataset.id), 'view'));
act('hire-open', (el) => svcDialog(findSvc(el.dataset.id), 'hire'));
act('plan-open', (el) => { if (!state.user) return needLogin(); svcDialog(findSvc(el.dataset.id), 'plan'); });
const readSel = (f) => ({ qty: Number(f.elements.qty?.value || 1), option_ids: [...f.querySelectorAll('input[name=opt]:checked')].map((o) => Number(o.value)) });
form('svc-view', (d, f) => form_hire(f)); form('svc-hire', (d, f) => form_hire(f));
function form_hire(f) {
  const s = findSvc(f.dataset.id), sel = readSel(f), p = P.provider;
  const c = state.cart && state.cart.provider_id === p.id ? state.cart : (state.cart = { provider_id: p.id, provider_slug: p.slug, provider_name: p.name, items: [], event_id: null });
  const ex = c.items.find((i) => i.service_id === s.id); if (ex) Object.assign(ex, sel); else c.items.push({ service_id: s.id, name: s.name, ...sel });
  store.set('cart', state.cart); closeDialog(); go('#/checkout');
}
form('svc-plan', async (d, f) => {
  const s = findSvc(f.dataset.id), sel = readSel(f);
  const evs = await api('/events');
  openDialog('Adicionar ao planejamento', html`<p><strong>${s.name}</strong> × ${sel.qty}</p><form data-form="plan-add" data-id="${s.id}" data-qty="${sel.qty}" data-opts="${sel.option_ids.join(',')}">
    ${evs.length ? field('Em qual festa?', 'event_id', { type: 'select', options: [...evs.map((e) => [e.id, `${e.name}${e.date ? ' · ' + fmtDate(e.date) : ''}`]), ['new', '+ Criar nova festa']] }) : html`<input type="hidden" name="event_id" value="new"><p class="notice info">Você ainda não tem festas. Vamos criar a primeira!</p>`}
    <div data-newevent>${field('Nome da nova festa', 'name', { placeholder: 'Ex.: Aniversário da Bia' })}${field('Data (opcional)', 'date', { type: 'date', min: today() })}</div>${errBox()}<button class="btn" type="submit">Adicionar</button></form>`);
});
form('plan-add', async (d, f) => {
  let eid = d.event_id;
  if (eid === 'new') { if (!d.name) throw new Error('Dê um nome para a nova festa.'); const s = savedLoc(); eid = (await api('/events', { method: 'POST', body: { name: d.name, date: d.date || null, type: null } })).id; }
  await api(`/events/${eid}/items`, { method: 'POST', body: { service_id: Number(f.dataset.id), qty: Number(f.dataset.qty), option_ids: f.dataset.opts ? f.dataset.opts.split(',').map(Number) : [] } });
  closeDialog(); toast('Adicionado ao planejamento!'); go('#/eventos/' + eid);
});

// solicitar orçamento
act('quote-open', async (el) => {
  if (!state.user) return needLogin();
  const p = P.provider, s = el.dataset.service ? findSvc(el.dataset.service) : null, evs = await api('/events');
  openDialog(s ? `Orçamento: ${s.name}` : `Falar com ${p.name}`, html`<form data-form="quote" data-provider="${p.id}" data-service="${s?.id || ''}">
    <p class="meta">O fornecedor responde com uma proposta detalhada (valor, validade e condições). Você também pode conversar por mensagem.</p>
    ${evs.length ? field('Vincular a uma festa (opcional)', 'event_id', { type: 'select', options: [['', 'Nenhuma'], ...evs.map((e) => [e.id, e.name])] }) : ''}
    <div class="cols">${field('Data do evento', 'date', { type: 'date', min: today(), required: true, value: new URLSearchParams(location.hash.split('?')[1] || '').get('date') || '' })}${field('Duração', 'duration', { placeholder: 'Ex.: 4 horas' })}${field('Nº de convidados', 'guests', { type: 'number', value: store.get('guests') || '', attrs: 'min="1"' })}</div>
    ${field('Local do evento (endereço)', 'location', { required: true, placeholder: 'Rua, número, bairro' })}
    ${field('Cidade', 'city', { type: 'select', value: p.city, options: [...(state.config.cities || []).map((c) => [c.name, `${c.name}/${c.state}`])] })}
    ${field('Observações', 'notes', { type: 'textarea', placeholder: 'Conte detalhes: tema, referências, restrições…' })}${errBox()}<button class="btn orange" type="submit">Enviar solicitação</button></form>`);
});
form('quote', async (d, f) => {
  const r = await api('/quotes', { method: 'POST', body: { provider_id: Number(f.dataset.provider), service_id: f.dataset.service ? Number(f.dataset.service) : null, event_id: d.event_id ? Number(d.event_id) : null, date: d.date, duration: d.duration, guests: d.guests ? Number(d.guests) : null, location: d.location, city: d.city, notes: d.notes } });
  closeDialog(); toast(r.availability?.available === false ? 'Solicitação enviada. Atenção: a data pode estar indisponível.' : 'Solicitação enviada! Você será avisado quando houver proposta.'); go('#/orcamentos/' + r.id);
});

// ---------------- autenticação ----------------
route('/entrar', (ctx) => {
  ctx.title = 'Entrar';
  return html`<div class="wrap page" style="max-width:460px"><h1>Entrar</h1><form class="card pad grid" data-form="login" data-next="${ctx.query.next || '/'}">${field('E-mail', 'email', { type: 'email', required: true, autocomplete: 'email' })}${field('Senha', 'password', { type: 'password', required: true, autocomplete: 'current-password' })}${errBox()}<button class="btn" type="submit">Entrar</button><p class="meta">Não tem conta? <a href="#/cadastro">Criar conta grátis</a></p></form>
  <div class="notice info"><strong>Contas de demonstração</strong> (senha <code>agitae123</code>): cliente@agitae.test · doce-sabor-confeitaria@agitae.test · clara-mendes-fotografia@agitae.test · admin@agitae.test</div></div>`;
});
form('login', async (d, f) => { await api('/auth/login', { method: 'POST', body: d }); window.dispatchEvent(new Event('agitae:user')); await new Promise((r) => setTimeout(r, 150)); go('#' + f.dataset.next); });
route('/cadastro', (ctx) => {
  ctx.title = 'Criar conta';
  return html`<div class="wrap page" style="max-width:460px"><h1>Criar conta</h1><form class="card pad grid" data-form="register">${field('Nome completo', 'name', { required: true, autocomplete: 'name' })}${field('E-mail', 'email', { type: 'email', required: true, autocomplete: 'email' })}${field('Telefone (opcional)', 'phone', { type: 'tel', autocomplete: 'tel' })}${field('Senha', 'password', { type: 'password', required: true, hint: 'Mínimo de 8 caracteres.', autocomplete: 'new-password', attrs: 'minlength="8"' })}
  <label class="check"><input type="checkbox" name="consent" required> <span>Li e aceito a <a href="#/privacidade" target="_blank">Política de Privacidade</a>.</span></label>${errBox()}<button class="btn" type="submit">Criar conta</button><p class="meta">Já tem conta? <a href="#/entrar">Entrar</a> · Quer vender serviços? <a href="#/fornecedor/cadastro">Cadastro de fornecedor</a></p></form></div>`;
});
form('register', async (d, f) => { await api('/auth/register', { method: 'POST', body: { ...d, consent: f.elements.consent.checked } }); window.dispatchEvent(new Event('agitae:user')); toast('Conta criada! Bem-vindo(a) à Agitaê.'); await new Promise((r) => setTimeout(r, 150)); go('#/'); });

route('/privacidade', (ctx) => {
  ctx.title = 'Política de Privacidade';
  return html`<div class="wrap page" style="max-width:800px"><h1>Política de Privacidade</h1><p class="notice">Modelo de política alinhado à LGPD (Lei 13.709/2018). Revise com assessoria jurídica e preencha os dados do controlador antes de publicar.</p>
  <h2>Quais dados coletamos</h2><p>Nome, e-mail, telefone (opcional), dados dos eventos que você cria, pedidos, mensagens e avaliações. Não armazenamos dados de cartão: pagamentos são processados pelo provedor de pagamentos.</p>
  <h2>Para que usamos</h2><p>Para criar sua conta, mostrar fornecedores da sua região, processar pedidos e pagamentos, enviar notificações do pedido e prevenir fraudes. A localização do dispositivo só é usada se você permitir, e apenas para buscar fornecedores próximos.</p>
  <h2>Com quem compartilhamos</h2><p>O fornecedor que você contrata recebe apenas os dados necessários para atender o pedido (nome, data, local, mensagens). Convidados de um evento veem somente o convite — nunca pedidos, valores ou pagamentos.</p>
  <h2>Por quanto tempo guardamos</h2><p>Dados da conta: enquanto ela existir. Dados fiscais e financeiros de pedidos: 5 anos, por obrigação legal. Após excluir a conta, dados pessoais são anonimizados.</p>
  <h2>Seus direitos</h2><p>Você pode acessar, corrigir, exportar (JSON) e excluir seus dados em <a href="#/conta">Minha conta</a>. Dúvidas: privacidade@agitae.com.br <em>(defina o contato do encarregado antes de publicar)</em>.</p>
  <h2>Cookies</h2><p>Usamos apenas um cookie de sessão essencial para manter você conectado.</p></div>`;
});

// ---------------- convite público ----------------
route('/convite/:token', async (ctx) => {
  const i = await api('/invites/' + ctx.params.token); ctx.title = i.title;
  return html`<div class="wrap page" style="max-width:560px;text-align:center"><div class="card pad"><div style="font-size:3rem" aria-hidden="true">🎉</div><h1>${i.title}</h1><p>${i.message || ''}</p><p><strong>${i.name}</strong><br>${i.date ? fmtDate(i.date) : 'Data a confirmar'}${i.city ? ' · ' + i.city : ''}${i.address ? html`<br>${i.address}` : ''}</p>
  <form class="grid" style="text-align:left" data-form="rsvp" data-token="${ctx.params.token}"><h2>Confirme sua presença</h2>${field('Seu nome', 'name', { required: true })}${field('Você vai?', 'status', { type: 'select', options: [['vou', 'Sim, eu vou! 🎉'], ['talvez', 'Talvez'], ['nao_vou', 'Não poderei ir']] })}${field('Acompanhantes', 'companions', { type: 'number', value: 0, attrs: 'min="0" max="20"' })}${errBox()}<button class="btn orange" type="submit">Enviar resposta</button></form></div></div>`;
});
form('rsvp', async (d, f) => { await api(`/invites/${f.dataset.token}/rsvp`, { method: 'POST', body: { ...d, companions: Number(d.companions || 0) } }); f.innerHTML = '<div class="notice ok" role="status"><strong>Resposta enviada!</strong> Obrigado por confirmar.</div>'; });

import { api, state, html, raw, route, act, form, field, empty, table, stars, money, fmtDate, fmtDateTime, statusTag, priceLabel, EVENT_TYPE, STATUS, store, toast, go, openDialog, closeDialog, errBox, back, toCents, centsToInput, showError } from './core.js';
import { providerCard } from './pages-public.js';

const today = () => state.config?.today;
const addDaysStr = (d, n) => { const t = new Date(d + 'T12:00:00Z'); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); };
const cityOpts = () => (state.config.cities || []).map((c) => [c.name, `${c.name}/${c.state}`]);

// ---------------- mensagens (pedido ou orçamento) ----------------
export const messagesBox = (kind, id) => html`<section class="section" aria-labelledby="msgs"><h2 id="msgs">Mensagens</h2><div class="chat" data-chat="${kind}/${id}" aria-live="polite" tabindex="0" aria-label="Histórico de mensagens"><span class="meta">Carregando…</span></div>
  <form class="inline" style="margin-top:8px" data-form="send-msg" data-thread="${kind}/${id}">${field('Nova mensagem', 'body', { required: true, placeholder: 'Escreva aqui…' })}<button class="btn" type="submit">Enviar</button></form>${errBox()}</section>`;
async function loadChat(root) {
  const box = root.querySelector('[data-chat]'); if (!box) return;
  const msgs = await api(`/threads/${box.dataset.chat}/messages`);
  box.innerHTML = msgs.length ? msgs.map((m) => html`<div class="msg ${m.mine ? 'mine' : ''}"><small>${m.mine ? 'Você' : m.sender} · ${fmtDateTime(m.created_at)}</small>${m.body}</div>`).join('') : '<span class="meta">Nenhuma mensagem ainda. Tire suas dúvidas aqui.</span>';
  box.scrollTop = box.scrollHeight;
}
form('send-msg', async (d, f) => { await api(`/threads/${f.dataset.thread}/messages`, { method: 'POST', body: d }); f.reset(); await loadChat(document); });

// ---------------- checkout ----------------
const getCart = () => state.cart || (state.cart = store.get('cart'));
route('/checkout', async (ctx) => {
  const cart = getCart(); ctx.title = 'Contratação';
  if (!cart || !cart.items.length) return html`<div class="wrap page">${empty('🛒', 'Nada para contratar', 'Escolha um serviço no perfil de um fornecedor.', html`<a class="btn" href="#/busca">Explorar fornecedores</a>`)}</div>`;
  const evs = await api('/events'), ev = cart.event_id ? evs.find((e) => e.id === cart.event_id) : null;
  ctx.mount = () => refreshPreview(document.querySelector('[data-form=checkout]'));
  return html`<div class="wrap page"><h1>Contratar ${cart.provider_name}</h1>${back('#/f/' + cart.provider_slug, 'Voltar ao perfil')}
  <div class="layout right"><form class="card pad grid" data-form="checkout" data-change="preview">
    <h2>Dados do evento</h2>
    ${evs.length ? field('Vincular a uma festa', 'event_id', { type: 'select', value: cart.event_id || '', options: [['', 'Nenhuma'], ...evs.map((e) => [e.id, e.name])] }) : ''}
    ${field('Data do evento', 'event_date', { type: 'date', required: true, min: today(), value: ev?.date || '' })}
    ${field('Endereço do evento', 'address', { required: true, value: ev?.address || '', placeholder: 'Rua, número, bairro' })}
    ${field('Cidade', 'city', { type: 'select', required: true, value: ev?.city || cart.city || '', options: [['', 'Selecione…'], ...cityOpts()] })}
    ${field('Observações para o fornecedor', 'notes', { type: 'textarea' })}
    ${field('Cupom de desconto', 'coupon', { placeholder: 'Ex.: BEMVINDO10', hint: 'O desconto é validado pelo sistema.' })}
    <div class="notice info"><strong>Como funciona:</strong> você envia o pedido, o fornecedor confirma que pode atender e só então você paga. A data é reservada quando o pagamento é confirmado.</div>
    ${errBox()}<button class="btn orange" type="submit">Enviar pedido ao fornecedor</button></form>
  <aside class="card pad" style="align-self:start"><h2>Resumo</h2><ul style="padding:0;list-style:none;margin:0 0 12px">${cart.items.map((i, n) => html`<li class="row between" style="margin-bottom:8px"><span>${i.name}</span><span><label class="meta" for="cq${n}">Qtd</label> <input id="cq${n}" type="number" min="1" value="${i.qty}" style="width:70px" data-act-change="cart-qty" data-n="${n}"> <button class="btn ghost sm" data-act="cart-del" data-n="${n}" aria-label="Remover ${i.name}">✕</button></span></li>`)}</ul><div id="preview" aria-live="polite"><p class="meta">Calculando…</p></div></aside></div></div>`;
});
document.addEventListener('change', (e) => {
  if (e.target.matches('[data-act-change=cart-qty]')) { getCart().items[Number(e.target.dataset.n)].qty = Math.max(1, Number(e.target.value) || 1); store.set('cart', state.cart); refreshPreview(document.querySelector('[data-form=checkout]')); }
  if (e.target.closest('[data-change=preview]')) refreshPreview(e.target.closest('form'));
  if (e.target.matches('[data-form=plan-add] select[name=event_id]')) e.target.closest('form').querySelector('[data-newevent]').hidden = e.target.value !== 'new';
});
act('cart-del', (el) => { const c = getCart(); c.items.splice(Number(el.dataset.n), 1); store.set('cart', c); location.reload(); });
async function refreshPreview(f) {
  if (!f) return; const box = document.getElementById('preview'), c = getCart();
  try {
    const p = await api('/orders/preview', { method: 'POST', body: { provider_id: c.provider_id, items: c.items.map((i) => ({ service_id: i.service_id, qty: i.qty, option_ids: i.option_ids })), city: f.elements.city.value || null, coupon: f.elements.coupon.value || null, event_date: f.elements.event_date.value || null } });
    const av = p.availability;
    box.innerHTML = html`${p.lines.map((l) => html`<div class="meta">${l.qty} × ${l.name}${l.options.length ? ' + ' + l.options.map((o) => o.name).join(', ') : ''}</div>`)}
      <div class="totals" style="margin-top:8px"><div><span>Itens</span><span>${money(p.items_cents)}</span></div><div><span>Adicionais</span><span>${money(p.options_cents)}</span></div>
      <div><span>Deslocamento</span><span>${p.travel_cents ? money(p.travel_cents) : 'Grátis'}</span></div>${p.discount_cents ? html`<div><span>Desconto (${p.coupon_code})</span><span>− ${money(p.discount_cents)}</span></div>` : ''}
      <div><span>Taxas para você</span><span>${p.fee_cents ? money(p.fee_cents) : 'R$ 0,00'}</span></div><div class="total"><span>Total</span><span>${money(p.total_cents)}</span></div></div>
      ${av.known ? (av.available ? html`<div class="notice ok">✔ Fornecedor disponível nesta data</div>` : html`<div class="notice bad">Indisponível: ${av.reason}</div>`) : ''}
      <p class="meta">Antecedência mínima para este pedido: ${p.lead_days} dia(s) (a partir de ${fmtDate(p.min_date)}).</p><p class="meta">${p.policies.cancel}</p>`.s;
    const d = f.elements.event_date; d.min = p.min_date;
  } catch (e) { box.innerHTML = html`<div class="notice bad" role="alert">${e.message}</div>`.s; }
}
form('checkout', async (d) => {
  const c = getCart();
  const r = await api('/orders', { method: 'POST', body: { provider_id: c.provider_id, event_id: d.event_id ? Number(d.event_id) : null, event_date: d.event_date, address: d.address, city: d.city, notes: d.notes, coupon: d.coupon || null, items: c.items.map((i) => ({ service_id: i.service_id, qty: i.qty, option_ids: i.option_ids })) } });
  state.cart = null; store.del('cart'); toast('Pedido enviado! Aguarde a confirmação do fornecedor.'); go('#/pedidos/' + r.id);
});

// ---------------- eventos / planejamento ----------------
route('/eventos', async (ctx) => {
  const evs = await api('/events'); ctx.title = 'Meus eventos';
  return html`<div class="wrap page"><div class="row between"><h1>Meus eventos</h1><button class="btn orange" data-act="event-new">+ Nova festa</button></div>
  ${evs.length ? html`<div class="grid g2">${evs.map((e) => { const tot = e.planned_cents + e.contracted_cents; return html`<a class="card pad pcard" href="#/eventos/${e.id}"><h3>${e.name}</h3><div class="meta">${e.type ? EVENT_TYPE[e.type] + ' · ' : ''}${e.date ? fmtDate(e.date) : 'Data a definir'}${e.city ? ' · ' + e.city : ''}${e.guests ? ' · ' + e.guests + ' convidados' : ''}</div><div>${e.items} item(ns) planejado(s) · ${e.orders} pedido(s)</div><strong>${money(tot)}</strong> <span class="meta">previstos${e.budget_cents ? ' de ' + money(e.budget_cents) : ''}</span>${e.budget_cents ? html`<div class="bar ${tot > e.budget_cents ? 'over' : ''}" role="img" aria-label="${Math.round((tot / e.budget_cents) * 100)}% do orçamento"><i style="width:${Math.min(100, (tot / e.budget_cents) * 100)}%"></i></div>` : ''}</a>`; })}</div>`
    : empty('🎉', 'Vamos organizar sua primeira festa?', 'Crie um evento para juntar fornecedores, ver o total previsto e enviar convites.', html`<button class="btn orange" data-act="event-new">Criar minha festa</button>`)}</div>`;
}, { auth: true });
const eventForm = (e = {}) => html`<form class="grid" data-form="event-save" data-id="${e.id || ''}">${field('Nome da festa', 'name', { required: true, value: e.name, placeholder: 'Ex.: Aniversário de 30 anos da Ana' })}
  <div class="cols">${field('Data', 'date', { type: 'date', value: e.date, min: today() })}${field('Tipo de festa', 'type', { type: 'select', value: e.type || '', options: [['', 'Selecione…'], ...Object.entries(EVENT_TYPE)] })}${field('Convidados', 'guests', { type: 'number', value: e.guests, attrs: 'min="1"' })}${field('Orçamento estimado (R$)', 'budget', { value: centsToInput(e.budget_cents), placeholder: '3.000,00', attrs: 'inputmode="decimal"' })}</div>
  ${field('Endereço', 'address', { value: e.address })}<div class="cols">${field('Cidade', 'city', { type: 'select', value: e.city || '', options: [['', 'Selecione…'], ...cityOpts()] })}${field('Bairro', 'neighborhood', { value: e.neighborhood })}</div>${errBox()}<button class="btn" type="submit">Salvar</button></form>`;
act('event-new', () => openDialog('Nova festa', eventForm()));
form('event-save', async (d, f) => {
  const city = state.config.cities.find((c) => c.name === d.city);
  const body = { name: d.name, date: d.date || null, type: d.type || null, guests: d.guests ? Number(d.guests) : null, budget_cents: d.budget ? toCents(d.budget) : null, address: d.address || null, city: d.city || null, state: city?.state || null, neighborhood: d.neighborhood || null };
  if (body.budget_cents !== null && Number.isNaN(body.budget_cents)) throw new Error('Orçamento inválido.');
  const r = f.dataset.id ? await api('/events/' + f.dataset.id, { method: 'PATCH', body }) : await api('/events', { method: 'POST', body });
  closeDialog(); toast('Festa salva!'); go('#/eventos/' + r.id); if (f.dataset.id) location.reload();
});
route('/eventos/:id', async (ctx) => {
  const { event: e, summary: s, invite, rsvps } = await api('/events/' + ctx.params.id); ctx.title = e.name;
  const byProv = {}; for (const i of s.items) (byProv[i.provider_id] ||= { name: i.provider_name, slug: i.provider_slug, items: [] }).items.push(i);
  const total = s.planned_cents + s.contracted_cents, over = e.budget_cents && total > e.budget_cents;
  const loc = e.city ? `&loc=${encodeURIComponent(e.city)}` : '', dt = e.date ? `&date=${e.date}` : '';
  window.__ev = e;
  return html`<div class="wrap page">${back('#/eventos', 'Meus eventos')}<div class="row between"><div><h1>${e.name}</h1><p class="meta">${e.type ? EVENT_TYPE[e.type] + ' · ' : ''}${e.date ? fmtDate(e.date) : 'Data a definir'}${e.city ? ' · ' + e.city : ''}${e.guests ? ' · ' + e.guests + ' convidados' : ''}</p></div><div class="row"><button class="btn ghost sm" data-act="event-edit">Editar</button><button class="btn danger sm" data-act="event-del" data-id="${e.id}" data-confirm="Excluir esta festa? Os pedidos já feitos são mantidos.">Excluir</button></div></div>
  <div class="layout right"><div>
    <section aria-labelledby="pl"><h2 id="pl">Planejamento</h2>${s.items.length ? Object.entries(byProv).map(([pid, g]) => html`<div class="card pad" style="margin-bottom:12px"><div class="row between"><h3><a href="#/f/${g.slug}">${g.name}</a></h3><button class="btn orange sm" data-act="event-hire" data-provider="${pid}" data-event="${e.id}">Contratar itens deste fornecedor</button></div>${table(['Item', 'Qtd', 'Valor', ''], g.items.map((i) => [html`${i.name}${i.options.length ? html`<br><span class="meta">+ ${i.options.map((o) => o.name).join(', ')}</span>` : ''}<br><span class="chip">${i.category}</span>`, i.qty, i.total_cents == null ? html`<span class="tag orange">Sob orçamento</span>` : money(i.total_cents), html`<button class="btn ghost sm" data-act="item-del" data-event="${e.id}" data-id="${i.id}" aria-label="Remover ${i.name}">Remover</button>`]))}${g.items.some((i) => i.total_cents == null) ? html`<p><a class="btn ghost sm" href="#/f/${g.slug}">Pedir orçamento no perfil</a></p>` : ''}</div>`) : empty('🧺', 'Nenhum item planejado', 'Explore as categorias abaixo e use "+ Planejamento" nos serviços que gostar.')}</section>
    <section class="section"><h2>Pedidos deste evento</h2>${s.orders.length ? table(['Pedido', 'Fornecedor', 'Data', 'Total', 'Status'], s.orders.map((o) => [html`<a href="#/pedidos/${o.id}">#${o.id}</a>`, o.provider_name, fmtDate(o.event_date), money(o.total_cents), statusTag(o.status)])) : html`<p class="meta">Quando você contratar, os pedidos aparecem aqui — cada fornecedor com seu próprio pedido, pagamento e status.</p>`}</section>
    <section class="section"><h2>O que falta contratar</h2><p class="meta">Categorias já cobertas ficam marcadas. Toque para procurar na sua região.</p><div class="chips">${s.needs.map((n) => html`<a class="chip" style="${n.covered ? 'background:var(--ok-soft);color:var(--ok)' : ''}" href="#/categoria/${n.slug}?x=1${loc}${dt}">${n.covered ? '✔' : n.icon} ${n.name}</a>`)}</div></section>
    <section class="section"><h2>Convite para os convidados</h2><div class="card pad">${invite ? html`<p><strong>${invite.title}</strong><br>${invite.message || ''}</p><div class="inline">${field('Link para compartilhar', 'link', { value: location.origin + '/#/convite/' + invite.token, attrs: 'readonly' })}<button class="btn ghost" data-act="copy-invite" data-token="${invite.token}">Copiar link</button></div>
      <p class="meta">Quem abre o link vê apenas o convite e confirma presença — sem acesso a pedidos ou pagamentos.</p>
      <h3>Confirmações: ${rsvps.filter((r) => r.status === 'vou').reduce((t, r) => t + 1 + r.companions, 0)} pessoa(s) confirmada(s)</h3>${rsvps.length ? table(['Nome', 'Resposta', 'Acompanhantes'], rsvps.map((r) => [r.name, { vou: 'Vai', talvez: 'Talvez', nao_vou: 'Não vai' }[r.status], r.companions])) : '<p class="meta">Ninguém respondeu ainda.</p>'}` : '<p class="meta">Crie um convite personalizado e compartilhe o link por WhatsApp.</p>'}
      <form class="grid" data-form="invite" data-event="${e.id}">${field('Título do convite', 'title', { required: true, value: invite?.title || e.name })}${field('Mensagem', 'message', { type: 'textarea', value: invite?.message || '' })}${errBox()}<button class="btn" type="submit">${invite ? 'Atualizar convite' : 'Criar convite'}</button></form></div></section>
  </div>
  <aside class="card pad" style="align-self:start;position:sticky;top:80px"><h2>Resumo consolidado</h2><div class="totals"><div><span>Planejado (a contratar)</span><span>${money(s.planned_cents)}</span></div><div><span>Já contratado</span><span>${money(s.contracted_cents)}</span></div><div class="total"><span>Total previsto</span><span>${money(total)}</span></div></div>
    ${s.quote_pending ? html`<p class="meta">+ ${s.quote_pending} item(ns) sob orçamento, ainda sem valor.</p>` : ''}
    ${e.budget_cents ? html`<p>Orçamento: ${money(e.budget_cents)}</p><div class="bar ${over ? 'over' : ''}" role="img" aria-label="${Math.round((total / e.budget_cents) * 100)}% do orçamento usado"><i style="width:${Math.min(100, (total / e.budget_cents) * 100)}%"></i></div><p class="${over ? 'tag bad' : 'meta'}">${over ? 'Acima do orçamento em ' + money(total - e.budget_cents) : 'Restam ' + money(e.budget_cents - total)}</p>` : '<p class="meta">Defina um orçamento estimado ao editar a festa.</p>'}</aside></div></div>`;
}, { auth: true });
act('event-edit', () => openDialog('Editar festa', eventForm(window.__ev)));
act('event-del', async (el) => { await api('/events/' + el.dataset.id, { method: 'DELETE' }); toast('Festa excluída.'); go('#/eventos'); });
act('item-del', async (el) => { await api(`/events/${el.dataset.event}/items/${el.dataset.id}`, { method: 'DELETE' }); toast('Item removido.'); location.reload(); });
act('copy-invite', async (el) => { try { await navigator.clipboard.writeText(location.origin + '/#/convite/' + el.dataset.token); toast('Link copiado!'); } catch { toast('Selecione e copie o link manualmente.', true); } });
form('invite', async (d, f) => { await api(`/events/${f.dataset.event}/invite`, { method: 'POST', body: d }); toast('Convite salvo!'); location.reload(); });
act('event-hire', async (el) => {
  const { summary, event } = await api('/events/' + el.dataset.event), items = summary.items.filter((i) => i.provider_id === Number(el.dataset.provider));
  if (items.some((i) => i.total_cents == null)) toast('Itens sob orçamento ficam de fora: peça a proposta no perfil.');
  const fixed = items.filter((i) => i.total_cents != null); if (!fixed.length) return;
  state.cart = { provider_id: fixed[0].provider_id, provider_slug: fixed[0].provider_slug, provider_name: fixed[0].provider_name, event_id: event.id, city: event.city, items: fixed.map((i) => ({ service_id: i.service_id, name: i.name, qty: i.qty, option_ids: i.options.map((o) => o.id) })) };
  store.set('cart', state.cart); go('#/checkout');
});

// ---------------- pedidos ----------------
route('/pedidos', async (ctx) => {
  const os = await api('/orders'); ctx.title = 'Meus pedidos';
  return html`<div class="wrap page"><h1>Meus pedidos</h1>${os.length ? html`<div class="tablewrap">${table(['Pedido', 'Fornecedor', 'Data do evento', 'Total', 'Status', ''], os.map((o) => [`#${o.id}`, html`<a href="#/f/${o.provider_slug}">${o.provider_name}</a>`, fmtDate(o.event_date), money(o.total_cents), statusTag(o.status), html`<a class="btn ghost sm" href="#/pedidos/${o.id}">Acompanhar</a>`]))}</div>` : empty('🧾', 'Você ainda não fez pedidos', 'Quando contratar um serviço, você acompanha tudo por aqui.', html`<a class="btn" href="#/busca">Explorar fornecedores</a>`)}</div>`;
}, { auth: true });
export async function orderPage(ctx, base) {
  const d = await api('/orders/' + ctx.params.id), o = d.order, role = d.role; ctx.title = 'Pedido #' + o.id;
  ctx.mount = () => loadChat(document);
  const cliente = role === 'cliente', forn = role === 'fornecedor';
  return html`<div class="wrap page">${back(base, cliente ? 'Meus pedidos' : 'Pedidos')}<div class="row between"><h1>Pedido #${o.id} ${statusTag(o.status)}</h1></div>
  <p class="meta">${cliente ? 'Fornecedor: ' + o.provider_name : 'Cliente: ' + o.customer_name} · Evento em ${fmtDate(o.event_date)}${o.city ? ' · ' + o.city : ''}</p>
  <div class="layout right"><div>
    ${o.status === 'aguardando_resposta' ? html`<div class="notice">${cliente ? 'Aguardando o fornecedor confirmar que pode atender. Você só paga depois.' : 'Confira o valor líquido e aceite ou recuse o pedido.'}</div>` : ''}
    ${o.status === 'aguardando_pagamento' ? html`<div class="notice info">${cliente ? '✔ O fornecedor aceitou! Pague para reservar a data.' : 'Aguardando o pagamento do cliente. A data ainda não está reservada.'}</div>` : ''}
    ${o.status === 'em_disputa' ? html`<div class="notice bad">Pedido em disputa. A equipe da Agitaê está analisando e entrará em contato.</div>` : ''}
    <section class="card pad"><h2>Itens</h2>${table(['Item', 'Qtd', 'Unitário', 'Total'], d.items.map((i) => [html`${i.name}${i.options.length ? html`<br><span class="meta">+ ${i.options.map((x) => `${x.name} (${money(x.price_cents)})`).join(', ')}</span>` : ''}`, i.qty, money(i.unit_cents), money(i.total_cents)]))}
      <div class="totals" style="margin-top:12px"><div><span>Itens</span><span>${money(o.items_cents)}</span></div>${o.options_cents ? html`<div><span>Adicionais</span><span>${money(o.options_cents)}</span></div>` : ''}<div><span>Deslocamento</span><span>${o.travel_cents ? money(o.travel_cents) : 'Grátis'}</span></div>${o.discount_cents ? html`<div><span>Desconto ${o.coupon_code || ''}</span><span>− ${money(o.discount_cents)}</span></div>` : ''}${cliente || role === 'admin' ? html`<div><span>Taxas</span><span>${money(o.fee_cents)}</span></div>` : ''}<div class="total"><span>Total</span><span>${money(o.total_cents)}</span></div>
      ${forn ? html`<div><span>Comissão da plataforma (${(o.commission_bps / 100).toLocaleString('pt-BR')}%)</span><span>− ${money(o.commission_cents)}</span></div><div class="total" style="color:var(--ok)"><span>Líquido previsto para você</span><span>${money(o.net_cents)}</span></div>` : ''}${role === 'admin' ? html`<div><span>Comissão (${(o.commission_bps / 100).toLocaleString('pt-BR')}%)</span><span>${money(o.commission_cents)}</span></div>` : ''}${o.refunded_cents ? html`<div><span>Estornado</span><span>${money(o.refunded_cents)}</span></div>` : ''}</div>
      ${o.address ? html`<p class="meta">Local: ${o.address}</p>` : ''}${o.notes ? html`<p class="meta">Observações: ${o.notes}</p>` : ''}</section>
    ${d.provider_contact && cliente ? html`<div class="notice ok"><strong>Contato do fornecedor:</strong> ${d.provider_contact.phone || ''} · ${d.provider_contact.address || ''}</div>` : ''}
    ${orderActions(d)}
    ${messagesBox('order', o.id)}
  </div><aside class="card pad" style="align-self:start"><h2>Acompanhamento</h2><ol class="timeline">${d.history.map((h) => html`<li class="${h.status === 'cancelado' || h.status === 'em_disputa' ? 'cancel' : ''}"><strong>${h.status_label}</strong><br><span class="meta">${fmtDateTime(h.created_at)}${h.note ? ' · ' + h.note : ''}</span></li>`)}</ol>
    ${d.payments.length ? html`<h3>Pagamentos</h3>${d.payments.map((p) => html`<p class="meta">${money(p.amount_cents)} · ${p.status}${p.method ? ' · ' + p.method : ''}${p.refunded_cents ? ' · estornado ' + money(p.refunded_cents) : ''}<br>${fmtDateTime(p.created_at)} · ${p.provider === 'teste' ? 'ambiente de teste' : p.provider}</p>`)}` : ''}
    <h3>Cancelamento</h3><p class="meta">Reembolso de 100% até 7 dias antes, 50% de 2 a 6 dias e sem reembolso com menos de 2 dias.</p>
    <a class="btn ghost sm" href="mailto:suporte@agitae.com.br?subject=Pedido%20%23${o.id}">Falar com o suporte</a></aside></div></div>`;
}
function orderActions(d) {
  const o = d.order, id = o.id, cliente = d.role === 'cliente', forn = d.role === 'fornecedor', b = [];
  if (cliente) {
    if (o.status === 'aguardando_pagamento') b.push(html`<button class="btn orange" data-act="order-pay" data-id="${id}">Pagar ${money(o.total_cents)}</button>`);
    if (['aguardando_resposta', 'aguardando_pagamento'].includes(o.status)) b.push(html`<button class="btn danger" data-act="order-cancel" data-id="${id}" data-confirm="Cancelar este pedido?">Cancelar pedido</button>`);
    if (o.status === 'confirmado') b.push(html`<button class="btn danger" data-act="order-cancel" data-id="${id}" data-confirm="Cancelar? Reembolso previsto: ${money(d.refund_preview_cents)}.">Cancelar (reembolso previsto: ${money(d.refund_preview_cents)})</button>`);
    if (['confirmado', 'em_preparacao', 'concluido'].includes(o.status)) b.push(html`<button class="btn ghost" data-act="order-dispute" data-id="${id}">Abrir disputa</button>`);
  }
  if (forn) {
    if (o.status === 'aguardando_resposta') { b.push(html`<button class="btn orange" data-act="order-do" data-do="accept" data-id="${id}">Aceitar pedido</button>`, html`<button class="btn danger" data-act="order-do" data-do="decline" data-id="${id}" data-confirm="Recusar este pedido?">Recusar</button>`); }
    if (o.status === 'confirmado') b.push(html`<button class="btn" data-act="order-do" data-do="start" data-id="${id}">Iniciar preparação</button>`);
    if (['confirmado', 'em_preparacao'].includes(o.status)) b.push(html`<button class="btn orange" data-act="order-do" data-do="complete" data-id="${id}" data-confirm="Marcar como concluído?">Marcar como concluído</button>`);
  }
  let review = '';
  if (cliente && o.status === 'concluido') review = d.review ? html`<div class="notice ok">Sua avaliação: ${'★'.repeat(d.review.rating)} — ${d.review.status === 'pendente' ? 'em moderação' : d.review.status}${d.review.reply ? html`<br>Resposta: ${d.review.reply}` : ''}</div>` : html`<form class="card pad grid" data-form="review" data-id="${id}"><h3>Como foi a contratação?</h3>${field('Nota', 'rating', { type: 'select', required: true, options: [['5', '5 — Excelente'], ['4', '4 — Muito bom'], ['3', '3 — Regular'], ['2', '2 — Ruim'], ['1', '1 — Péssimo']] })}${field('Comentário', 'comment', { type: 'textarea' })}${errBox()}<button class="btn" type="submit">Enviar avaliação</button></form>`;
  return html`${b.length ? html`<div class="row" style="margin:12px 0">${b}</div>` : ''}${review}`;
}
act('order-pay', async (el) => { const r = await api(`/orders/${el.dataset.id}/pay`, { method: 'POST' }); if (r.test_checkout) go('#' + r.test_checkout); else toast('Pagamento indisponível no momento.', true); });
act('order-cancel', async (el) => { await api(`/orders/${el.dataset.id}/cancel`, { method: 'POST', body: {} }); toast('Pedido cancelado.'); location.reload(); });
act('order-do', async (el) => { await api(`/orders/${el.dataset.id}/${el.dataset.do}`, { method: 'POST', body: {} }); toast('Pedido atualizado.'); location.reload(); });
act('order-dispute', (el) => openDialog('Abrir disputa', html`<form class="grid" data-form="dispute" data-id="${el.dataset.id}"><p class="meta">Descreva o problema. A equipe da Agitaê vai analisar e o repasse ao fornecedor fica em espera.</p>${field('O que aconteceu?', 'reason', { type: 'textarea', required: true, hint: 'Mínimo de 10 caracteres.' })}${errBox()}<button class="btn danger" type="submit">Enviar disputa</button></form>`));
form('dispute', async (d, f) => { await api(`/orders/${f.dataset.id}/dispute`, { method: 'POST', body: d }); closeDialog(); toast('Disputa aberta.'); location.reload(); });
form('review', async (d, f) => { const r = await api(`/orders/${f.dataset.id}/review`, { method: 'POST', body: { rating: Number(d.rating), comment: d.comment } }); toast(r.message); location.reload(); });
route('/pedidos/:id', (ctx) => orderPage(ctx, '#/pedidos'), { auth: true });

// pagamento em ambiente de teste
route('/pagamento-teste/:ext', async (ctx) => {
  const d = await api('/pay/test/' + ctx.params.ext); ctx.title = 'Pagamento (teste)';
  if (d.payment.status !== 'pendente') return html`<div class="wrap page" style="max-width:560px">${empty('ℹ️', 'Esta cobrança já foi processada', 'Status: ' + d.payment.status, html`<a class="btn" href="#/pedidos/${d.order.id}">Ver pedido</a>`)}</div>`;
  return html`<div class="wrap page" style="max-width:560px"><div class="notice bad"><strong>AMBIENTE DE TESTE.</strong> Nenhum dinheiro é cobrado. Em produção este passo é feito no provedor de pagamentos.</div>
  <div class="card pad grid"><h1>Pagar pedido #${d.order.id}</h1><p>${d.order.provider_name} · evento em ${fmtDate(d.order.event_date)}</p><div class="totals"><div class="total"><span>Total</span><span>${money(d.payment.amount_cents)}</span></div></div>
  <form class="grid" data-form="test-pay" data-ext="${ctx.params.ext}">${field('Forma de pagamento (simulada)', 'method', { type: 'select', options: [['pix', 'Pix'], ['cartao', 'Cartão de crédito'], ['boleto', 'Boleto']] })}${errBox()}
  <button class="btn orange" type="submit" data-result="approved">Simular pagamento aprovado</button><button class="btn danger" type="submit" data-result="failed">Simular pagamento recusado</button></form></div></div>`;
}, { auth: true });
document.addEventListener('click', (e) => { const b = e.target.closest('[data-form=test-pay] button[data-result]'); if (b) b.form.dataset.result = b.dataset.result; });
form('test-pay', async (d, f) => {
  const r = await api('/pay/test/' + f.dataset.ext, { method: 'POST', body: { result: f.dataset.result || 'approved', method: d.method } });
  toast(r.status === 'confirmado' ? 'Pagamento aprovado! Pedido confirmado.' : r.status === 'falhou' ? 'Pagamento recusado.' : 'A data ficou indisponível; o valor foi estornado.', r.status !== 'confirmado'); go('#/pedidos/' + r.order_id);
});

// ---------------- orçamentos ----------------
route('/orcamentos', async (ctx) => {
  const qs = await api('/quotes'); ctx.title = 'Orçamentos';
  const open = (await Promise.all(qs.filter((q) => q.open_proposals).map((q) => api('/quotes/' + q.id)))).flatMap((d) => d.proposals.filter((p) => p.status === 'enviada' && !p.expired).map((p) => ({ q: d.quote, p })));
  return html`<div class="wrap page"><h1>Orçamentos</h1>${qs.length ? table(['#', 'Fornecedor', 'Serviço', 'Data', 'Status', ''], qs.map((q) => [q.id, q.provider_name, q.service_name || 'Geral', fmtDate(q.date), statusTag(q.status), html`<a class="btn ghost sm" href="#/orcamentos/${q.id}">Abrir</a>`])) : empty('📨', 'Nenhuma solicitação', 'Peça orçamento no perfil de um fornecedor.', html`<a class="btn" href="#/busca">Explorar</a>`)}
  ${open.length ? html`<section class="section"><h2>Comparar propostas recebidas</h2>${table(['Fornecedor', 'Serviço', 'Data do evento', 'Valor', 'Válida até', ''], open.map(({ q, p }) => [q.provider_name, q.service_name || 'Geral', fmtDate(q.date), html`<strong>${money(p.price_cents)}</strong>`, fmtDate(p.valid_until), html`<a class="btn sm" href="#/orcamentos/${q.id}">Ver e aceitar</a>`]))}</section>` : ''}</div>`;
}, { auth: true });
export async function quotePage(ctx, base) {
  const d = await api('/quotes/' + ctx.params.id), q = d.quote, forn = d.role === 'fornecedor'; ctx.title = 'Orçamento #' + q.id; ctx.mount = () => loadChat(document);
  return html`<div class="wrap page">${back(base, 'Voltar')}<h1>Orçamento #${q.id} ${statusTag(q.status)}</h1>
  <div class="card pad"><div class="cols"><div><strong>${forn ? 'Cliente' : 'Fornecedor'}</strong><br>${forn ? q.customer_name : q.provider_name}</div><div><strong>Serviço</strong><br>${q.service_name || 'Geral'}</div><div><strong>Data</strong><br>${fmtDate(q.date)}</div><div><strong>Convidados</strong><br>${q.guests || '—'}</div><div><strong>Duração</strong><br>${q.duration || '—'}</div><div><strong>Local</strong><br>${q.location || '—'}${q.city ? ', ' + q.city : ''}</div></div>${q.notes ? html`<p><strong>Observações:</strong> ${q.notes}</p>` : ''}</div>
  ${d.order ? html`<div class="notice ok">Pedido gerado: <a href="#/${forn ? 'fornecedor/' : ''}pedidos/${d.order.id}">#${d.order.id}</a> (${STATUS[d.order.status]?.[0]})</div>` : ''}
  <section class="section"><h2>Propostas</h2>${d.proposals.length ? d.proposals.map((p) => html`<div class="card pad" style="margin-bottom:10px"><div class="row between"><strong style="font-size:1.4rem">${money(p.price_cents)}</strong><span class="tag ${p.status === 'enviada' && !p.expired ? 'info' : 'warn'}">${p.expired ? 'expirada' : p.status}</span></div><p>${p.details}</p>${p.conditions ? html`<p class="meta"><strong>Condições:</strong> ${p.conditions}</p>` : ''}<p class="meta">Válida até ${fmtDate(p.valid_until)}</p>
    ${!forn && p.status === 'enviada' && !p.expired ? html`<button class="btn orange" data-act="quote-accept" data-q="${q.id}" data-p="${p.id}">Aceitar proposta e ir para o pagamento</button>` : ''}</div>`) : html`<p class="meta">${forn ? 'Você ainda não enviou proposta.' : 'Aguardando a proposta do fornecedor. Você será notificado.'}</p>`}
    ${forn && ['aguardando_resposta', 'proposta_enviada'].includes(q.status) ? html`<form class="card pad grid" data-form="proposal" data-id="${q.id}"><h3>${d.proposals.length ? 'Enviar nova proposta' : 'Enviar proposta'}</h3>${field('Valor total (R$)', 'price', { required: true, placeholder: '1.500,00', attrs: 'inputmode="decimal"' })}${field('Detalhes do que está incluído', 'details', { type: 'textarea', required: true })}${field('Condições (sinal, cancelamento…)', 'conditions', { type: 'textarea' })}${field('Válida até', 'valid_until', { type: 'date', required: true, min: today(), value: addDaysStr(today(), 7) })}${errBox()}<div class="row"><button class="btn orange" type="submit">Enviar proposta</button><button class="btn danger" type="button" data-act="quote-decline" data-id="${q.id}" data-confirm="Recusar esta solicitação?">Recusar solicitação</button></div></form>` : ''}
    ${!forn && ['aguardando_resposta', 'proposta_enviada'].includes(q.status) ? html`<button class="btn danger" data-act="quote-cancel" data-id="${q.id}" data-confirm="Cancelar esta solicitação?">Cancelar solicitação</button>` : ''}</section>
  ${messagesBox('quote', q.id)}</div>`;
}
act('quote-accept', async (el) => { const r = await api(`/quotes/${el.dataset.q}/accept`, { method: 'POST', body: { proposal_id: Number(el.dataset.p) } }); toast('Proposta aceita! Falta o pagamento.'); go('#/pedidos/' + r.order_id); });
act('quote-cancel', async (el) => { await api(`/quotes/${el.dataset.id}/cancel`, { method: 'POST', body: {} }); toast('Solicitação cancelada.'); location.reload(); });
act('quote-decline', async (el) => { await api(`/provider/quotes/${el.dataset.id}/decline`, { method: 'POST', body: {} }); toast('Solicitação recusada.'); go('#/fornecedor/solicitacoes'); });
form('proposal', async (d, f) => {
  const price = toCents(d.price); if (!price || Number.isNaN(price) || price < 1) throw new Error('Informe um valor válido.');
  await api(`/provider/quotes/${f.dataset.id}/proposal`, { method: 'POST', body: { price_cents: price, details: d.details, conditions: d.conditions, valid_until: d.valid_until } }); toast('Proposta enviada ao cliente!'); location.reload();
});
route('/orcamentos/:id', (ctx) => quotePage(ctx, '#/orcamentos'), { auth: true });

// ---------------- conta / notificações ----------------
route('/notificacoes', async (ctx) => {
  const ns = await api('/notifications'); ctx.title = 'Notificações';
  await api('/notifications/read', { method: 'POST' }); window.dispatchEvent(new Event('agitae:user'));
  return html`<div class="wrap page" style="max-width:760px"><h1>Notificações</h1>${ns.length ? ns.map((n) => html`<a class="card pad" style="display:block;margin-bottom:8px;text-decoration:none;color:inherit;${n.read ? '' : 'border-color:var(--blue)'}" href="#${n.link || '/'}"><strong>${n.title}</strong> ${n.read ? '' : html`<span class="tag info">nova</span>`}<br><span class="meta">${n.body || ''} · ${fmtDateTime(n.created_at)}</span></a>`) : empty('🔔', 'Sem notificações', 'Avisos sobre pedidos, propostas e mensagens aparecem aqui.')}</div>`;
}, { auth: true });
route('/conta', async (ctx) => {
  const favs = await api('/favorites'); const u = state.user; ctx.title = 'Minha conta';
  return html`<div class="wrap page" style="max-width:820px"><h1>Minha conta</h1>
  <form class="card pad grid" data-form="profile"><h2>Meus dados</h2>${field('Nome', 'name', { value: u.name, required: true })}${field('E-mail', 'email', { value: u.email, attrs: 'readonly' })}${field('Telefone', 'phone', { value: u.phone || '', type: 'tel' })}
    <details><summary>Alterar senha</summary>${field('Senha atual', 'current_password', { type: 'password' })}${field('Nova senha', 'password', { type: 'password', attrs: 'minlength="8"', hint: 'Mínimo de 8 caracteres.' })}</details>${errBox()}<button class="btn" type="submit">Salvar</button></form>
  <section class="section"><h2>Fornecedores salvos</h2>${favs.length ? html`<div class="chips">${favs.map((f) => html`<a class="chip" href="#/f/${f.slug}">♥ ${f.name}</a>`)}</div>` : '<p class="meta">Você ainda não salvou nenhum fornecedor.</p>'}</section>
  <section class="section card pad"><h2>Privacidade e dados (LGPD)</h2><p class="meta">Você pode baixar uma cópia dos seus dados ou solicitar a exclusão da conta. Dados fiscais de pedidos são mantidos por 5 anos por obrigação legal. <a href="#/privacidade">Política de Privacidade</a></p><div class="row"><button class="btn ghost" data-act="export-data">Baixar meus dados (JSON)</button><button class="btn danger" data-act="delete-account">Excluir minha conta</button></div></section></div>`;
}, { auth: true });
form('profile', async (d) => { await api('/me', { method: 'PATCH', body: { name: d.name, phone: d.phone, ...(d.password ? { password: d.password, current_password: d.current_password } : {}) } }); window.dispatchEvent(new Event('agitae:user')); toast('Dados atualizados.'); });
act('export-data', async () => { const data = await api('/me/export'); const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })); a.download = 'meus-dados-agitae.json'; a.click(); });
act('delete-account', () => openDialog('Excluir conta', html`<form class="grid" data-form="delete-account"><p>Isso anonimiza seus dados pessoais e encerra seu acesso. Não é possível desfazer. Você não pode ter pedidos em andamento.</p>${field('Confirme sua senha', 'password', { type: 'password', required: true })}${errBox()}<button class="btn danger" type="submit">Excluir definitivamente</button></form>`));
form('delete-account', async (d) => { await api('/me/delete', { method: 'POST', body: d }); closeDialog(); state.user = null; window.dispatchEvent(new Event('agitae:user')); toast('Conta excluída.'); go('#/'); });

import { api, state, html, raw, route, act, form, field, empty, table, money, fmtDate, fmtDateTime, statusTag, priceKind, EVENT_TYPE, toast, go, openDialog, closeDialog, errBox, toCents, centsToInput, t, track } from './core.js';
import { lang } from './i18n.js';
import { orderPage, quotePage } from './pages-client.js';

const R = { auth: true, role: 'fornecedor' };
const today = () => state.config?.today;
const cityOpts = () => (state.config.cities || []).map((c) => [c.name, `${c.name}/${c.state}`]);
const cityName = (slug) => (state.config.cities.find((c) => c.slug === slug) || {}).name || slug;
const TABS = () => [['/fornecedor', t('Resumo')], ['/fornecedor/solicitacoes', t('Solicitações')], ['/fornecedor/pedidos', t('Pedidos')], ['/fornecedor/servicos', t('Serviços')], ['/fornecedor/agenda', t('Agenda')], ['/fornecedor/avaliacoes', t('Avaliações')], ['/fornecedor/financeiro', t('Financeiro')], ['/fornecedor/perfil', t('Perfil e áreas')]];
const tabs = (cur) => html`<nav class="tabs" aria-label="${t('Painel do fornecedor')}">${TABS().map(([h, l]) => html`<a href="#${h}" ${h === cur ? raw('aria-current="page"') : ''}>${l}</a>`)}</nav>`;
const notApproved = () => (state.user.provider && state.user.provider.status !== 'aprovado' ? html`<div class="notice ${state.user.provider.status === 'pendente' ? '' : 'bad'}"><strong>${t('Cadastro {s}.', { s: { pendente: t('pendente'), suspenso: t('suspenso'), rejeitado: t('rejeitado') }[state.user.provider.status] })}</strong> ${state.user.provider.status === 'pendente' ? t('Seu perfil só aparece para clientes depois da aprovação da Agitaê. Enquanto isso, você já pode cadastrar serviços e áreas.') : t('Entre em contato com o suporte.')}</div>` : '');

// ---------------- cadastro ----------------
route('/fornecedor/cadastro', (ctx) => {
  ctx.title = t('Cadastro de fornecedor');
  if (state.user?.provider) return html`<div class="wrap page">${empty('✅', t('Você já tem cadastro de fornecedor'), t('Status: {s}', { s: state.user.provider.status }), html`<a class="btn" href="#/fornecedor">${t('Ir para o painel')}</a>`)}</div>`;
  if (!state.user) return html`<div class="wrap page" style="max-width:680px"><h1>${t('Venda na Agitaê')}</h1><p>${t('Sem mensalidade: você só paga uma comissão quando vender. Mostre seus serviços para quem está organizando festas na sua região.')}</p><a class="btn" href="#/cadastro">${t('Criar conta')}</a> <a class="btn ghost" href="#/entrar?next=/fornecedor/cadastro">${t('Já tenho conta')}</a></div>`;
  return html`<div class="wrap page" style="max-width:740px"><h1>${t('Cadastro de fornecedor')}</h1><p class="meta">${t('Depois do envio, nossa equipe analisa o cadastro antes de publicar o perfil. A comissão da plataforma é exibida antes de você aceitar cada pedido.')}</p>
  <form class="card pad grid" data-form="prov-register">${field(t('Nome comercial'), 'name', { required: true })}${field(t('Descrição do negócio'), 'description', { type: 'textarea', required: true, hint: t('Mínimo de 10 caracteres.') })}
  <div class="cols">${field(t('Cidade'), 'city', { type: 'select', required: true, options: [['', t('Selecione…')], ...cityOpts()] })}${field('UF', 'state', { required: true, attrs: 'maxlength="2"', placeholder: 'SP' })}${field(t('Bairro'), 'neighborhood')}</div>
  ${field(t('Endereço'), 'address')}<div class="cols">${field(t('Telefone / WhatsApp'), 'phone', { type: 'tel' })}${field(t('CPF ou CNPJ'), 'document', { hint: t('Usado na verificação. Não é exibido publicamente.') })}</div>${field(t('Horários de atendimento'), 'hours', { placeholder: t('Seg a sex, 9h às 18h') })}
  <p class="meta">${t('Se sua cidade não estiver na lista, ela ainda não é atendida pela plataforma.')}</p>${errBox()}<button class="btn orange" type="submit">${t('Enviar cadastro para análise')}</button></form></div>`;
});
form('prov-register', async (d) => { await api('/provider/register', { method: 'POST', body: d }); track('provider_registered'); window.dispatchEvent(new Event('agitae:user')); toast(t('Cadastro enviado! Aguarde a aprovação.')); await new Promise((r) => setTimeout(r, 200)); go('#/fornecedor'); });

// ---------------- resumo / métricas ----------------
route('/fornecedor', async (ctx) => {
  const q = new URLSearchParams(); if (ctx.query.from) q.set('from', ctx.query.from); if (ctx.query.to) q.set('to', ctx.query.to);
  const [me, m] = await Promise.all([api('/provider/me'), api('/provider/metrics?' + q)]); ctx.title = t('Painel do fornecedor');
  return html`<div class="wrap page dash"><h1>${me.provider.name}</h1>${tabs('/fornecedor')}${notApproved()}
  ${me.counts.pending_quotes || me.counts.pending_orders ? html`<div class="notice info" role="status">${t('Você tem')} <a href="#/fornecedor/solicitacoes">${t('{n} solicitação(ões) de orçamento', { n: me.counts.pending_quotes })}</a> ${t('e')} <a href="#/fornecedor/pedidos">${t('{n} pedido(s)', { n: me.counts.pending_orders })}</a> ${t('aguardando resposta.')}</div>` : ''}
  <form class="inline" data-form="period" style="max-width:560px">${field(t('De'), 'from', { type: 'date', value: m.from })}${field(t('Até'), 'to', { type: 'date', value: m.to })}<button class="btn ghost" type="submit">${t('Filtrar período')}</button></form>
  <div class="kpis" style="margin-top:14px"><div class="kpi"><b>${m.views}</b><span>${t('Visitas ao perfil')}</span></div><div class="kpi"><b>${m.quotes}</b><span>${t('Pedidos de orçamento')}</span></div><div class="kpi"><b>${m.requests}</b><span>${t('Pedidos criados')}</span></div><div class="kpi"><b>${m.orders}</b><span>${t('Pedidos pagos')}</span></div>
  <div class="kpi"><b>${money(m.gross)}</b><span>${t('Receita bruta')}</span></div><div class="kpi"><b>${money(m.commission)}</b><span>${t('Comissão da plataforma')} (${(me.provider.commission_bps_effective / 100).toLocaleString('pt-BR')}%)</span></div><div class="kpi"><b style="color:var(--ok)">${money(m.net)}</b><span>${t('Receita líquida')}</span></div><div class="kpi"><b>${m.rating ? m.rating.rating.toFixed(1) + ' ★' : '—'}</b><span>${m.rating ? t('{n} avaliações', { n: m.rating.review_count }) : t('Sem avaliações')}</span></div></div>
  <section class="section"><h2>${t('Receita líquida por dia')}</h2>${m.series.length ? table([t('Dia'), t('Pedidos'), t('Líquido')], m.series.map((s) => [fmtDate(s.day), s.orders, money(s.net)])) : `<p class="meta">${t('Sem vendas no período.')}</p>`}</section>
  ${me.provider.status === 'aprovado' ? html`<p><a class="btn ghost" href="#/f/${me.provider.slug}">${t('Ver meu perfil público')}</a></p>` : ''}</div>`;
}, R);
form('period', (d) => go(`#/fornecedor?from=${d.from}&to=${d.to}`));

// ---------------- solicitações e pedidos ----------------
route('/fornecedor/solicitacoes', async (ctx) => {
  const qs = await api('/provider/quotes'); ctx.title = t('Solicitações');
  return html`<div class="wrap page dash"><h1>${t('Solicitações de orçamento')}</h1>${tabs('/fornecedor/solicitacoes')}${qs.length ? table(['#', t('Cliente'), t('Serviço'), t('Data'), t('Convidados'), t('Status'), ''], qs.map((q) => [q.id, q.customer_name, q.service_name || t('Geral'), fmtDate(q.date), q.guests || '—', statusTag(q.status), html`<a class="btn sm" href="#/fornecedor/solicitacoes/${q.id}">${q.status === 'aguardando_resposta' ? t('Responder') : t('Abrir')}</a>`])) : empty('📭', t('Nenhuma solicitação ainda'), t('Quando um cliente pedir orçamento, ela aparece aqui.'))}</div>`;
}, R);
route('/fornecedor/solicitacoes/:id', (ctx) => quotePage(ctx, '#/fornecedor/solicitacoes'), R);
route('/fornecedor/pedidos', async (ctx) => {
  const os = await api('/provider/orders'); ctx.title = t('Pedidos');
  return html`<div class="wrap page dash"><h1>${t('Pedidos recebidos')}</h1>${tabs('/fornecedor/pedidos')}${os.length ? table(['#', t('Cliente'), t('Data'), t('Total'), t('Líquido'), t('Status'), ''], os.map((o) => [o.id, o.customer_name, fmtDate(o.event_date), money(o.total_cents), html`<strong style="color:var(--ok)">${money(o.net_cents)}</strong>`, statusTag(o.status), html`<a class="btn sm" href="#/fornecedor/pedidos/${o.id}">${o.status === 'aguardando_resposta' ? t('Responder') : t('Abrir')}</a>`])) : empty('📦', t('Nenhum pedido ainda'), t('Os pedidos dos clientes aparecem aqui, com o valor líquido previsto.'))}</div>`;
}, R);
route('/fornecedor/pedidos/:id', (ctx) => orderPage(ctx, '#/fornecedor/pedidos'), R);

// ---------------- serviços ----------------
let SVC = [], COMM = 750;
route('/fornecedor/servicos', async (ctx) => {
  const [list, me] = await Promise.all([api('/provider/services'), api('/provider/me')]); SVC = list; COMM = me.provider.commission_bps_effective; ctx.title = t('Serviços');
  return html`<div class="wrap page dash"><div class="row between"><h1>${t('Meus serviços')}</h1><button class="btn orange" data-act="svc-new">${t('+ Novo serviço')}</button></div>${tabs('/fornecedor/servicos')}${notApproved()}
  ${list.length ? table([t('Serviço'), t('Categoria'), t('Preço'), t('Tipo'), t('Ativo'), ''], list.map((s) => [html`<strong>${s.name}</strong>${s.hidden ? html` <span class="tag bad">${t('oculto pela moderação')}</span>` : ''}${s.featured ? html` <span class="tag orange">${t('destaque')}</span>` : ''}`, s.cat_name, s.price_type === 'orcamento' ? '—' : money(s.price_cents) + ' / ' + s.unit, html`<span class="tag ${priceKind(s.price_type)[1]}">${priceKind(s.price_type)[0]}</span>`, html`<label class="check"><input type="checkbox" data-act="svc-toggle" data-id="${s.id}" ${s.active ? 'checked' : ''} aria-label="${t('Ativar {n}', { n: s.name })}"> ${s.active ? t('Sim') : t('Não')}</label>`, html`<button class="btn ghost sm" data-act="svc-edit" data-id="${s.id}">${t('Editar')}</button> <button class="btn danger sm" data-act="svc-del" data-id="${s.id}" data-confirm="${t('Remover este serviço?')}">${t('Remover')}</button>`])) : empty('🧁', t('Cadastre seu primeiro serviço'), t('Adicione preços, fotos e adicionais para os clientes contratarem.'), html`<button class="btn orange" data-act="svc-new">${t('Novo serviço')}</button>`)}</div>`;
}, R);
function svcForm(s = {}) {
  const cats = state.config.categories, opts = (s.options || []).map((o) => `${o.name} | ${centsToInput(o.price_cents)}`).join('\n');
  return html`<form class="grid" data-form="svc-save" data-id="${s.id || ''}">${field(t('Nome do serviço ou produto'), 'name', { required: true, value: s.name })}
    <div class="cols">${field(t('Categoria'), 'category_id', { type: 'select', required: true, value: s.category_id, options: cats.map((c) => [c.id, c.name]) })}${field(t('Tipo de preço'), 'price_type', { type: 'select', value: s.price_type || 'fechado', options: [['fechado', t('Preço fechado')], ['a_partir_de', t('A partir de (preço inicial)')], ['orcamento', t('Sob orçamento (proposta)')]] })}${field(t('Preço (R$)'), 'price', { value: centsToInput(s.price_cents || null), placeholder: '150,00', attrs: 'inputmode="decimal" data-pricein', hint: t('Deixe em branco se for sob orçamento.') })}${field(t('Unidade'), 'unit', { value: s.unit || t('unidade'), required: true, placeholder: t('cento, kg, hora, convidado…') })}</div>
    <p class="notice info" data-net role="status">${t('Informe o preço para ver quanto você recebe após a comissão de {c}%.', { c: (COMM / 100).toLocaleString('pt-BR') })}</p>
    ${field(t('Descrição'), 'description', { type: 'textarea', value: s.description })}${field(t('O que está incluído'), 'includes', { type: 'textarea', value: s.includes })}
    <div class="cols">${field(t('Quantidade mínima'), 'min_qty', { type: 'number', value: s.min_qty || 1, attrs: 'min="1"' })}${field(t('Antecedência necessária (dias)'), 'lead_days', { type: 'number', value: s.lead_days ?? 2, attrs: 'min="0"' })}</div>
    ${field(t('Política de entrega / deslocamento'), 'delivery_policy', { value: s.delivery_policy })}${field(t('Condições de cancelamento'), 'cancel_policy', { value: s.cancel_policy })}
    <fieldset style="border:1px solid var(--line);border-radius:12px"><legend>${t('Tipos de festa (vazio = todos)')}</legend><div class="chips">${Object.entries(EVENT_TYPE()).map(([k, l]) => html`<label class="check"><input type="checkbox" name="ev_${k}" ${(s.event_types || '').split(',').includes(k) ? 'checked' : ''}> ${l}</label>`)}</div></fieldset>
    ${field(t('Adicionais (um por linha: Nome | preço)'), 'options', { type: 'textarea', value: opts, placeholder: t('Forminhas personalizadas | 35,00') })}
    <div class="field"><label for="f-images">${t('Imagens (uma URL por linha)')}</label><textarea id="f-images" name="images" rows="2">${(s.images || []).join('\n')}</textarea><input type="file" accept="image/jpeg,image/png,image/webp" data-upload="f-images" aria-label="${t('Enviar imagem (JPG, PNG ou WebP, até 3 MB)')}"><small>${t('JPG, PNG ou WebP até 3 MB. Imagens passam por moderação.')}</small></div>
    <label class="check"><input type="checkbox" name="featured" ${s.featured ? 'checked' : ''}> ${t('Serviço de destaque do perfil')}</label><label class="check"><input type="checkbox" name="active" ${s.active === 0 ? '' : 'checked'}> ${t('Ativo (visível para clientes)')}</label>${errBox()}<button class="btn" type="submit">${t('Salvar serviço')}</button></form>`;
}
document.addEventListener('input', (e) => { if (!e.target.matches('[data-pricein]')) return; const c = toCents(e.target.value), n = e.target.closest('form').querySelector('[data-net]'); if (c > 0) n.textContent = t('Comissão de {c}% = {v}. Você recebe {n} por unidade (sem contar deslocamento e descontos).', { c: (COMM / 100).toLocaleString('pt-BR'), v: money(Math.round(c * COMM / 10000)), n: money(c - Math.round(c * COMM / 10000)) }); });
document.addEventListener('change', async (e) => {
  const inp = e.target.closest('[data-upload]'); if (!inp || !inp.files[0]) return;
  const file = inp.files[0];
  try { const j = await api('/uploads', { method: 'POST', raw: file, headers: { 'Content-Type': file.type } }); const tg = document.getElementById(inp.dataset.upload); tg.value = tg.tagName === 'INPUT' ? j.url : (tg.value ? tg.value + '\n' : '') + j.url; toast(t('Imagem enviada!')); } catch (err) { toast(err.message, true); }
  inp.value = '';
});
act('svc-new', () => openDialog(t('Novo serviço'), svcForm(), 'wide'));
act('svc-edit', (el) => openDialog(t('Editar serviço'), svcForm(SVC.find((s) => s.id === Number(el.dataset.id))), 'wide'));
form('svc-save', async (d, f) => {
  const price_type = d.price_type, price = toCents(d.price);
  if (price_type !== 'orcamento' && (!price || Number.isNaN(price))) throw new Error(t('Informe o preço.'));
  const options = (d.options || '').split('\n').map((l) => l.trim()).filter(Boolean).map((l) => { const [n, p] = l.split('|'); const c = toCents(p || '0'); if (Number.isNaN(c)) throw new Error(t('Preço inválido no adicional "{n}".', { n })); return { name: n.trim(), price_cents: c || 0 }; });
  const body = { name: d.name, category_id: Number(d.category_id), price_type, price_cents: price_type === 'orcamento' ? 0 : price, unit: d.unit, description: d.description, includes: d.includes, min_qty: Number(d.min_qty), lead_days: Number(d.lead_days), delivery_policy: d.delivery_policy, cancel_policy: d.cancel_policy,
    event_types: Object.keys(EVENT_TYPE()).filter((k) => d['ev_' + k]), options, images: (d.images || '').split('\n').map((x) => x.trim()).filter(Boolean), featured: !!d.featured, active: !!d.active };
  await api(f.dataset.id ? '/provider/services/' + f.dataset.id : '/provider/services', { method: f.dataset.id ? 'PATCH' : 'POST', body }); track('service_saved');
  closeDialog(); toast(t('Serviço salvo!')); location.reload();
});
act('svc-toggle', async (el) => { await api('/provider/services/' + el.dataset.id, { method: 'PATCH', body: { active: el.checked } }); toast(el.checked ? t('Serviço ativado.') : t('Serviço desativado.')); });
act('svc-del', async (el) => { const r = await api('/provider/services/' + el.dataset.id, { method: 'DELETE' }); toast(r.deactivated ? t('O serviço tem histórico e foi apenas desativado.') : t('Serviço removido.')); location.reload(); });

// ---------------- agenda ----------------
route('/fornecedor/agenda', async (ctx) => {
  const a = await api('/provider/agenda?month=' + (ctx.query.month || '')); ctx.title = t('Agenda');
  const [y, m] = a.month.split('-').map(Number), first = new Date(Date.UTC(y, m - 1, 1)), days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const prev = new Date(Date.UTC(y, m - 2, 1)).toISOString().slice(0, 7), next = new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 7);
  const cells = []; for (let i = 0; i < first.getUTCDay(); i++) cells.push(html`<div style="border:0;background:none"></div>`);
  for (let d = 1; d <= days; d++) { const ds = `${a.month}-${String(d).padStart(2, '0')}`, blk = a.blocks.find((b) => b.date === ds), bk = a.bookings.filter((b) => b.date === ds); cells.push(html`<button type="button" class="${blk ? 'blk' : bk.length ? 'bk' : ''}" data-act="day-toggle" data-date="${ds}" data-blocked="${blk ? 1 : 0}" aria-label="${d} — ${blk ? t('bloqueado') : bk.length ? t('{n} reserva(s)', { n: bk.length }) : t('livre')}. ${t('Ativar/desativar bloqueio')}"><strong>${d}</strong><br>${blk ? '🚫 ' + t('Bloqueado') : ''}${bk.length ? html`📅 ${bk.length}/${a.capacity}` : ''}</button>`); }
  const wd = lang === 'en' ? ['S', 'M', 'T', 'W', 'T', 'F', 'S'] : ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
  return html`<div class="wrap page dash"><h1>${t('Agenda')}</h1>${tabs('/fornecedor/agenda')}<div class="row between"><a class="btn ghost sm" href="#/fornecedor/agenda?month=${prev}">← ${t('Mês anterior')}</a><strong>${new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString(lang === 'en' ? 'en-US' : 'pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' })}</strong><a class="btn ghost sm" href="#/fornecedor/agenda?month=${next}">${t('Próximo mês')} →</a></div>
  <p class="meta">${t('Clique em um dia para bloqueá-lo ou liberá-lo. 📅 mostra reservas confirmadas (pagas) sobre a capacidade diária de {n} evento(s). Capacidade e prazo mínimo são definidos em Perfil.', { n: a.capacity })}</p>
  <div class="cal" role="group" aria-label="${t('Calendário')}">${wd.map((d) => html`<div class="h">${d}</div>`)}${cells}</div></div>`;
}, R);
act('day-toggle', async (el) => { const blocked = el.dataset.blocked === '1'; await api('/provider/blocks', { method: 'PUT', body: { date: el.dataset.date, blocked: !blocked, reason: 'Bloqueado pelo fornecedor' } }); toast(blocked ? t('Data liberada.') : t('Data bloqueada.')); location.reload(); });

// ---------------- avaliações / financeiro ----------------
route('/fornecedor/avaliacoes', async (ctx) => {
  const rs = await api('/provider/reviews'); ctx.title = t('Avaliações');
  return html`<div class="wrap page dash"><h1>${t('Avaliações')}</h1>${tabs('/fornecedor/avaliacoes')}${rs.length ? rs.map((r) => html`<div class="card pad" style="margin-bottom:12px"><div class="row between"><strong>${r.author}</strong><span class="stars" style="color:#E08A00">${'★'.repeat(r.rating)}${'☆'.repeat(5 - r.rating)}</span><span class="tag ${r.status === 'publicada' ? 'ok' : 'warn'}">${{ publicada: t('publicada'), pendente: t('pendente'), rejeitada: t('rejeitada') }[r.status]}</span></div><p>${r.comment || ''}</p>${r.reply ? html`<div class="notice info"><strong>${t('Sua resposta')}:</strong> ${r.reply}</div>` : html`<form class="inline" data-form="reply" data-id="${r.id}">${field(t('Responder'), 'reply', { required: true })}<button class="btn sm" type="submit">${t('Publicar resposta')}</button></form>`}</div>`) : empty('⭐', t('Sem avaliações ainda'), t('Clientes só avaliam depois de contratações concluídas.'))}</div>`;
}, R);
form('reply', async (d, f) => { await api(`/provider/reviews/${f.dataset.id}/reply`, { method: 'POST', body: d }); toast(t('Resposta publicada.')); location.reload(); });
route('/fornecedor/financeiro', async (ctx) => {
  const ps = await api('/provider/payouts'); ctx.title = t('Financeiro');
  const sum = (s) => ps.filter((p) => p.status === s).reduce((x, p) => x + p.amount_cents, 0);
  return html`<div class="wrap page dash"><h1>${t('Financeiro')}</h1>${tabs('/fornecedor/financeiro')}<div class="kpis"><div class="kpi"><b>${money(sum('pendente'))}</b><span>${t('Repasses pendentes')}</span></div><div class="kpi"><b>${money(sum('pago'))}</b><span>${t('Repasses pagos')}</span></div></div>
  <p class="meta">${t('Repasses são liberados após a conclusão do pedido, sem disputa. O valor já é líquido da comissão da plataforma. Em produção, o prazo segue as regras do provedor de pagamentos.')}</p>
  ${ps.length ? table([t('Pedido'), t('Evento'), t('Valor líquido'), t('Status'), t('Pago em')], ps.map((p) => [html`<a href="#/fornecedor/pedidos/${p.order_id}">#${p.order_id}</a>`, fmtDate(p.event_date), money(p.amount_cents), { pendente: t('pendente'), pago: t('pago'), cancelado: t('cancelado') }[p.status], p.paid_at ? fmtDate(p.paid_at) : '—'])) : empty('💰', t('Sem repasses ainda'), t('Eles aparecem quando você concluir pedidos.'))}</div>`;
}, R);

// ---------------- perfil, áreas e portfólio ----------------
route('/fornecedor/perfil', async (ctx) => {
  const d = await api('/provider/me'), p = d.provider; ctx.title = t('Perfil');
  const label = (a) => a.type === 'cidade' ? t('Cidade: {n}', { n: cityName(a.city_slug) }) : a.type === 'bairro' ? t('Bairro: {b} ({c})', { b: a.neighborhood, c: cityName(a.city_slug) }) : a.type === 'cep' ? t('CEPs {a} a {b}', { a: String(a.cep_from).padStart(5, '0'), b: String(a.cep_to).padStart(5, '0') }) : t('Raio de {n} km', { n: a.radius_km });
  window.__areas = d.areas;
  return html`<div class="wrap page dash"><h1>${t('Perfil e áreas atendidas')}</h1>${tabs('/fornecedor/perfil')}${notApproved()}
  <form class="card pad grid" data-form="prov-save"><h2>${t('Dados comerciais')}</h2>${field(t('Nome comercial'), 'name', { value: p.name, required: true })}${field(t('Descrição'), 'description', { type: 'textarea', value: p.description, required: true })}
  <div class="cols">${field(t('Cidade'), 'city', { value: p.city, required: true })}${field('UF', 'state', { value: p.state, attrs: 'maxlength="2"', required: true })}${field(t('Bairro'), 'neighborhood', { value: p.neighborhood })}</div>${field(t('Endereço'), 'address', { value: p.address })}
  <div class="cols">${field(t('Telefone'), 'phone', { value: p.phone })}${field(t('Horários'), 'hours', { value: p.hours })}</div>
  <h3>${t('Agenda e deslocamento')}</h3><div class="cols">${field(t('Prazo mínimo (dias)'), 'min_notice_days', { type: 'number', value: p.min_notice_days, attrs: 'min="0"' })}${field(t('Eventos por dia (capacidade)'), 'capacity_per_day', { type: 'number', value: p.capacity_per_day, attrs: 'min="1"' })}${field(t('Taxa de deslocamento (R$)'), 'travel', { value: centsToInput(p.travel_fee_cents), attrs: 'inputmode="decimal"', hint: t('Cobrada quando o evento é fora da sua cidade.') })}</div>${field(t('Regra de deslocamento'), 'travel_policy', { value: p.travel_policy })}
  <div class="field"><label for="f-cover_url">${t('Imagem de capa (URL)')}</label><input id="f-cover_url" name="cover_url" value="${p.cover_url || ''}"><input type="file" accept="image/jpeg,image/png,image/webp" data-upload="f-cover_url" aria-label="${t('Enviar capa')}"></div>
  <div class="field"><label for="f-logo_url">${t('Logo ou foto (URL)')}</label><input id="f-logo_url" name="logo_url" value="${p.logo_url || ''}"><input type="file" accept="image/jpeg,image/png,image/webp" data-upload="f-logo_url" aria-label="${t('Enviar logo')}"></div>
  <div class="notice info">${t('Plano')}: <strong>${p.plan === 'premium' ? 'Premium' : t('Básico')}</strong> · ${t('Comissão da plataforma')}: <strong>${(p.commission_bps_effective / 100).toLocaleString('pt-BR')}%</strong> ${t('por pedido, sem mensalidade. Você vê o valor líquido antes de aceitar cada pedido.')}</div>${errBox()}<button class="btn" type="submit">${t('Salvar perfil')}</button></form>
  <section class="section card pad"><h2>${t('Áreas atendidas')}</h2><p class="meta">${t('Clientes só encontram você se estiverem dentro de uma destas áreas.')}</p>${d.areas.length ? html`<ul>${d.areas.map((a, i) => html`<li>${label(a)} <button class="btn ghost sm" data-act="area-del" data-i="${i}">${t('Remover')}</button></li>`)}</ul>` : `<p class="notice">${t('Nenhuma área cadastrada: você não aparece nas buscas por local.')}</p>`}
  <form class="grid" data-form="area-add"><div class="cols">${field(t('Tipo'), 'type', { type: 'select', options: [['cidade', t('Cidade inteira')], ['bairro', t('Bairro')], ['cep', t('Faixa de CEP')], ['raio', t('Raio a partir do meu endereço')]] })}${field(t('Cidade'), 'city', { type: 'select', options: cityOpts() })}${field(t('Bairro'), 'neighborhood')}${field(t('CEP inicial (5 dígitos)'), 'cep_from', { attrs: 'maxlength="5"' })}${field(t('CEP final (5 dígitos)'), 'cep_to', { attrs: 'maxlength="5"' })}${field(t('Raio (km)'), 'radius_km', { type: 'number', attrs: 'min="1"' })}</div>${errBox()}<button class="btn ghost" type="submit">${t('Adicionar área')}</button></form></section>
  <section class="section card pad"><h2>${t('Portfólio')}</h2><div class="gallery">${d.media.map((m) => html`<figure style="margin:0">${m.type === 'imagem' ? html`<img src="${m.url}" alt="${m.caption || t('Foto do portfólio')}">` : html`<a href="${m.url}" target="_blank" rel="noopener noreferrer">🎬 ${m.caption || m.url}</a>`}<figcaption class="meta tiny">${m.hidden ? '🚫 ' + t('oculta pela moderação') + ' · ' : ''}<button class="btn danger sm" data-act="media-del" data-id="${m.id}">${t('Remover')}</button></figcaption></figure>`)}</div>
  <form class="grid" style="margin-top:14px" data-form="media-add"><div class="cols">${field(t('Tipo'), 'type', { type: 'select', options: [['imagem', t('Foto')], ['video', t('Vídeo (link https)')]] })}${field(t('Legenda'), 'caption')}</div><div class="field"><label for="f-media_url">${t('Endereço da mídia')}</label><input id="f-media_url" name="url" required><input type="file" accept="image/jpeg,image/png,image/webp" data-upload="f-media_url" aria-label="${t('Enviar foto')}"></div>${errBox()}<button class="btn ghost" type="submit">${t('Adicionar ao portfólio')}</button></form></section></div>`;
}, R);
form('prov-save', async (d) => {
  const travel = d.travel ? toCents(d.travel) : 0; if (Number.isNaN(travel)) throw new Error(t('Taxa de deslocamento inválida.'));
  await api('/provider/me', { method: 'PATCH', body: { ...d, travel_fee_cents: travel, min_notice_days: Number(d.min_notice_days), capacity_per_day: Number(d.capacity_per_day) } }); toast(t('Perfil salvo.'));
});
const areaPayload = (x) => ({ ...x, city: cityName(x.city_slug) });
const saveAreas = async (areas) => { await api('/provider/areas', { method: 'PUT', body: { areas } }); toast(t('Áreas atualizadas.')); location.reload(); };
form('area-add', (d) => saveAreas([...window.__areas.map(areaPayload), { type: d.type, city: d.city, neighborhood: d.neighborhood, cep_from: d.cep_from, cep_to: d.cep_to, radius_km: d.radius_km }]));
act('area-del', (el) => saveAreas(window.__areas.filter((_, i) => i !== Number(el.dataset.i)).map(areaPayload)));
form('media-add', async (d) => { await api('/provider/media', { method: 'POST', body: d }); toast(t('Adicionado ao portfólio (sujeito a moderação).')); location.reload(); });
act('media-del', async (el) => { await api('/provider/media/' + el.dataset.id, { method: 'DELETE' }); location.reload(); });

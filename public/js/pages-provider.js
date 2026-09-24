import { api, state, html, raw, route, act, form, field, empty, table, stars, money, fmtDate, fmtDateTime, statusTag, priceKind, EVENT_TYPE, store, toast, go, openDialog, closeDialog, errBox, toCents, centsToInput } from './core.js';
import { orderPage, quotePage } from './pages-client.js';

const R = { auth: true, role: 'fornecedor' };
const today = () => state.config?.today;
const cityOpts = () => (state.config.cities || []).map((c) => [c.name, `${c.name}/${c.state}`]);
const TABS = [['/fornecedor', 'Resumo'], ['/fornecedor/solicitacoes', 'Solicitações'], ['/fornecedor/pedidos', 'Pedidos'], ['/fornecedor/servicos', 'Serviços'], ['/fornecedor/agenda', 'Agenda'], ['/fornecedor/avaliacoes', 'Avaliações'], ['/fornecedor/financeiro', 'Financeiro'], ['/fornecedor/perfil', 'Perfil e áreas']];
const tabs = (cur) => html`<nav class="tabs" aria-label="Painel do fornecedor">${TABS.map(([h, l]) => html`<a href="#${h}" ${h === cur ? raw('aria-current="page"') : ''}>${l}</a>`)}</nav>`;
const notApproved = () => (state.user.provider && state.user.provider.status !== 'aprovado' ? html`<div class="notice ${state.user.provider.status === 'pendente' ? '' : 'bad'}"><strong>Cadastro ${state.user.provider.status}.</strong> ${state.user.provider.status === 'pendente' ? 'Seu perfil só aparece para clientes depois da aprovação da Agitaê. Enquanto isso, você já pode cadastrar serviços e áreas.' : 'Entre em contato com o suporte.'}</div>` : '');

// ---------------- cadastro ----------------
route('/fornecedor/cadastro', (ctx) => {
  ctx.title = 'Cadastro de fornecedor';
  if (state.user?.provider) return html`<div class="wrap page">${empty('✅', 'Você já tem cadastro de fornecedor', `Status: ${state.user.provider.status}`, html`<a class="btn" href="#/fornecedor">Ir para o painel</a>`)}</div>`;
  if (!state.user) return html`<div class="wrap page" style="max-width:640px"><h1>Venda na Agitaê</h1><p>Sem mensalidade: você só paga uma comissão quando vender. Mostre seus serviços para quem está organizando festas na sua região.</p><a class="btn" href="#/cadastro">Criar conta</a> <a class="btn ghost" href="#/entrar?next=/fornecedor/cadastro">Já tenho conta</a></div>`;
  return html`<div class="wrap page" style="max-width:720px"><h1>Cadastro de fornecedor</h1><p class="meta">Depois do envio, nossa equipe analisa o cadastro antes de publicar o perfil. Comissão inicial padrão da plataforma: definida pela administração e exibida antes de você aceitar cada pedido.</p>
  <form class="card pad grid" data-form="prov-register">${field('Nome comercial', 'name', { required: true })}${field('Descrição do negócio', 'description', { type: 'textarea', required: true, hint: 'Mínimo de 10 caracteres.' })}
  <div class="cols">${field('Cidade', 'city', { type: 'select', required: true, options: [['', 'Selecione…'], ...(state.config.cities || []).map((c) => [c.name, `${c.name}/${c.state}`])] })}${field('UF', 'state', { required: true, attrs: 'maxlength="2"', placeholder: 'SP' })}${field('Bairro', 'neighborhood')}</div>
  ${field('Endereço', 'address')}<div class="cols">${field('Telefone / WhatsApp', 'phone', { type: 'tel' })}${field('CPF ou CNPJ', 'document', { hint: 'Usado na verificação. Não é exibido publicamente.' })}</div>${field('Horários de atendimento', 'hours', { placeholder: 'Seg a sex, 9h às 18h' })}
  <p class="meta">Se sua cidade não estiver na lista, ela ainda não é atendida pela plataforma.</p>${errBox()}<button class="btn orange" type="submit">Enviar cadastro para análise</button></form></div>`;
});
form('prov-register', async (d) => { await api('/provider/register', { method: 'POST', body: d }); window.dispatchEvent(new Event('agitae:user')); toast('Cadastro enviado! Aguarde a aprovação.'); await new Promise((r) => setTimeout(r, 200)); go('#/fornecedor'); });

// ---------------- resumo / métricas ----------------
route('/fornecedor', async (ctx) => {
  const q = new URLSearchParams(); if (ctx.query.from) q.set('from', ctx.query.from); if (ctx.query.to) q.set('to', ctx.query.to);
  const [me, m] = await Promise.all([api('/provider/me'), api('/provider/metrics?' + q)]); ctx.title = 'Painel do fornecedor';
  return html`<div class="wrap page"><h1>${me.provider.name}</h1>${tabs('/fornecedor')}${notApproved()}
  ${me.counts.pending_quotes || me.counts.pending_orders ? html`<div class="notice info" role="status">Você tem <a href="#/fornecedor/solicitacoes">${me.counts.pending_quotes} solicitação(ões) de orçamento</a> e <a href="#/fornecedor/pedidos">${me.counts.pending_orders} pedido(s)</a> aguardando resposta.</div>` : ''}
  <form class="inline" data-form="period" style="max-width:560px">${field('De', 'from', { type: 'date', value: m.from })}${field('Até', 'to', { type: 'date', value: m.to })}<button class="btn ghost" type="submit">Filtrar período</button></form>
  <div class="kpis" style="margin-top:12px"><div class="kpi"><b>${m.views}</b><span>Visitas ao perfil</span></div><div class="kpi"><b>${m.quotes}</b><span>Pedidos de orçamento</span></div><div class="kpi"><b>${m.requests}</b><span>Pedidos criados</span></div><div class="kpi"><b>${m.orders}</b><span>Pedidos pagos</span></div>
  <div class="kpi"><b>${money(m.gross)}</b><span>Receita bruta</span></div><div class="kpi"><b>${money(m.commission)}</b><span>Comissão da plataforma (${(me.provider.commission_bps_effective / 100).toLocaleString('pt-BR')}%)</span></div><div class="kpi"><b style="color:var(--ok)">${money(m.net)}</b><span>Receita líquida</span></div><div class="kpi"><b>${m.rating ? m.rating.rating.toFixed(1) + ' ★' : '—'}</b><span>${m.rating ? m.rating.review_count + ' avaliações' : 'Sem avaliações'}</span></div></div>
  <section class="section"><h2>Receita líquida por dia</h2>${m.series.length ? table(['Dia', 'Pedidos', 'Líquido'], m.series.map((s) => [fmtDate(s.day), s.orders, money(s.net)])) : '<p class="meta">Sem vendas no período.</p>'}</section>
  ${me.provider.status === 'aprovado' ? html`<p><a class="btn ghost" href="#/f/${me.provider.slug}">Ver meu perfil público</a></p>` : ''}</div>`;
}, R);
form('period', (d) => go(`#/fornecedor?from=${d.from}&to=${d.to}`));

// ---------------- solicitações e pedidos ----------------
route('/fornecedor/solicitacoes', async (ctx) => {
  const qs = await api('/provider/quotes'); ctx.title = 'Solicitações';
  return html`<div class="wrap page"><h1>Solicitações de orçamento</h1>${tabs('/fornecedor/solicitacoes')}${qs.length ? table(['#', 'Cliente', 'Serviço', 'Data', 'Convidados', 'Status', ''], qs.map((q) => [q.id, q.customer_name, q.service_name || 'Geral', fmtDate(q.date), q.guests || '—', statusTag(q.status), html`<a class="btn sm" href="#/fornecedor/solicitacoes/${q.id}">${q.status === 'aguardando_resposta' ? 'Responder' : 'Abrir'}</a>`])) : empty('📭', 'Nenhuma solicitação ainda', 'Quando um cliente pedir orçamento, ela aparece aqui.')}</div>`;
}, R);
route('/fornecedor/solicitacoes/:id', (ctx) => quotePage(ctx, '#/fornecedor/solicitacoes'), R);
route('/fornecedor/pedidos', async (ctx) => {
  const os = await api('/provider/orders'); ctx.title = 'Pedidos';
  return html`<div class="wrap page"><h1>Pedidos recebidos</h1>${tabs('/fornecedor/pedidos')}${os.length ? table(['#', 'Cliente', 'Data', 'Total', 'Líquido', 'Status', ''], os.map((o) => [o.id, o.customer_name, fmtDate(o.event_date), money(o.total_cents), html`<strong style="color:var(--ok)">${money(o.net_cents)}</strong>`, statusTag(o.status), html`<a class="btn sm" href="#/fornecedor/pedidos/${o.id}">${o.status === 'aguardando_resposta' ? 'Responder' : 'Abrir'}</a>`])) : empty('📦', 'Nenhum pedido ainda', 'Os pedidos dos clientes aparecem aqui, com o valor líquido previsto.')}</div>`;
}, R);
route('/fornecedor/pedidos/:id', (ctx) => orderPage(ctx, '#/fornecedor/pedidos'), R);

// ---------------- serviços ----------------
let SVC = [], COMM = 750;
route('/fornecedor/servicos', async (ctx) => {
  const [list, me] = await Promise.all([api('/provider/services'), api('/provider/me')]); SVC = list; COMM = me.provider.commission_bps_effective; ctx.title = 'Serviços';
  return html`<div class="wrap page"><div class="row between"><h1>Meus serviços</h1><button class="btn orange" data-act="svc-new">+ Novo serviço</button></div>${tabs('/fornecedor/servicos')}${notApproved()}
  ${list.length ? table(['Serviço', 'Categoria', 'Preço', 'Tipo', 'Ativo', ''], list.map((s) => [html`<strong>${s.name}</strong>${s.hidden ? html` <span class="tag bad">oculto pela moderação</span>` : ''}${s.featured ? html` <span class="tag orange">destaque</span>` : ''}`, s.cat_name, s.price_type === 'orcamento' ? '—' : money(s.price_cents) + ' / ' + s.unit, html`<span class="tag ${priceKind(s.price_type)[1]}">${priceKind(s.price_type)[0]}</span>`, html`<label class="check"><input type="checkbox" data-act="svc-toggle" data-id="${s.id}" ${s.active ? 'checked' : ''} aria-label="Ativar ${s.name}"> ${s.active ? 'Sim' : 'Não'}</label>`, html`<button class="btn ghost sm" data-act="svc-edit" data-id="${s.id}">Editar</button> <button class="btn danger sm" data-act="svc-del" data-id="${s.id}" data-confirm="Remover este serviço?">Remover</button>`])) : empty('🧁', 'Cadastre seu primeiro serviço', 'Adicione preços, fotos e adicionais para os clientes contratarem.', html`<button class="btn orange" data-act="svc-new">Novo serviço</button>`)}</div>`;
}, R);
function svcForm(s = {}) {
  const cats = state.config.categories, opts = (s.options || []).map((o) => `${o.name} | ${centsToInput(o.price_cents)}`).join('\n');
  return html`<form class="grid" data-form="svc-save" data-id="${s.id || ''}">${field('Nome do serviço ou produto', 'name', { required: true, value: s.name })}
    <div class="cols">${field('Categoria', 'category_id', { type: 'select', required: true, value: s.category_id, options: cats.map((c) => [c.id, c.name]) })}${field('Tipo de preço', 'price_type', { type: 'select', value: s.price_type || 'fechado', options: [['fechado', 'Preço fechado'], ['a_partir_de', 'A partir de (preço inicial)'], ['orcamento', 'Sob orçamento (proposta)']] })}${field('Preço (R$)', 'price', { value: centsToInput(s.price_cents || null), placeholder: '150,00', attrs: 'inputmode="decimal" data-pricein', hint: 'Deixe em branco se for sob orçamento.' })}${field('Unidade', 'unit', { value: s.unit || 'unidade', required: true, placeholder: 'cento, kg, hora, convidado…' })}</div>
    <p class="notice info" data-net role="status">Informe o preço para ver quanto você recebe após a comissão de ${(COMM / 100).toLocaleString('pt-BR')}%.</p>
    ${field('Descrição', 'description', { type: 'textarea', value: s.description })}${field('O que está incluído', 'includes', { type: 'textarea', value: s.includes })}
    <div class="cols">${field('Quantidade mínima', 'min_qty', { type: 'number', value: s.min_qty || 1, attrs: 'min="1"' })}${field('Antecedência necessária (dias)', 'lead_days', { type: 'number', value: s.lead_days ?? 2, attrs: 'min="0"' })}</div>
    ${field('Política de entrega / deslocamento', 'delivery_policy', { value: s.delivery_policy })}${field('Condições de cancelamento', 'cancel_policy', { value: s.cancel_policy })}
    <fieldset style="border:1px solid var(--line);border-radius:10px"><legend>Tipos de festa (vazio = todos)</legend><div class="chips">${Object.entries(EVENT_TYPE).map(([k, l]) => html`<label class="check"><input type="checkbox" name="ev_${k}" ${(s.event_types || '').split(',').includes(k) ? 'checked' : ''}> ${l}</label>`)}</div></fieldset>
    ${field('Adicionais (um por linha: Nome | preço)', 'options', { type: 'textarea', value: opts, placeholder: 'Forminhas personalizadas | 35,00' })}
    <div class="field"><label for="f-images">Imagens (uma URL por linha)</label><textarea id="f-images" name="images" rows="2">${(s.images || []).join('\n')}</textarea><input type="file" accept="image/jpeg,image/png,image/webp" data-upload="f-images" aria-label="Enviar imagem (JPG, PNG ou WebP, até 3 MB)"><small>JPG, PNG ou WebP até 3 MB. Imagens passam por moderação.</small></div>
    <label class="check"><input type="checkbox" name="featured" ${s.featured ? 'checked' : ''}> Serviço de destaque do perfil</label><label class="check"><input type="checkbox" name="active" ${s.active === 0 ? '' : 'checked'}> Ativo (visível para clientes)</label>${errBox()}<button class="btn" type="submit">Salvar serviço</button></form>`;
}
document.addEventListener('input', (e) => { if (!e.target.matches('[data-pricein]')) return; const c = toCents(e.target.value), n = e.target.closest('form').querySelector('[data-net]'); if (c > 0) n.textContent = `Comissão de ${(COMM / 100).toLocaleString('pt-BR')}% = ${money(Math.round(c * COMM / 10000))}. Você recebe ${money(c - Math.round(c * COMM / 10000))} por unidade (sem contar deslocamento e descontos).`; });
document.addEventListener('change', async (e) => {
  const inp = e.target.closest('[data-upload]'); if (!inp || !inp.files[0]) return;
  const file = inp.files[0];
  try { const r = await fetch('/api/uploads', { method: 'POST', headers: { 'Content-Type': file.type, 'X-Requested-With': 'agitae' }, body: file }); const j = await r.json(); if (!r.ok) throw new Error(j.error); const t = document.getElementById(inp.dataset.upload); t.value = (t.value ? t.value + '\n' : '') + j.url; if (t.tagName === 'INPUT') t.value = j.url; toast('Imagem enviada!'); } catch (err) { toast(err.message, true); }
  inp.value = '';
});
act('svc-new', () => openDialog('Novo serviço', svcForm()));
act('svc-edit', (el) => openDialog('Editar serviço', svcForm(SVC.find((s) => s.id === Number(el.dataset.id)))));
form('svc-save', async (d, f) => {
  const price_type = d.price_type, price = toCents(d.price);
  if (price_type !== 'orcamento' && (!price || Number.isNaN(price))) throw new Error('Informe o preço.');
  const options = (d.options || '').split('\n').map((l) => l.trim()).filter(Boolean).map((l) => { const [n, p] = l.split('|'); const c = toCents(p || '0'); if (Number.isNaN(c)) throw new Error(`Preço inválido no adicional "${n}".`); return { name: n.trim(), price_cents: c || 0 }; });
  const body = { name: d.name, category_id: Number(d.category_id), price_type, price_cents: price_type === 'orcamento' ? 0 : price, unit: d.unit, description: d.description, includes: d.includes, min_qty: Number(d.min_qty), lead_days: Number(d.lead_days), delivery_policy: d.delivery_policy, cancel_policy: d.cancel_policy,
    event_types: Object.keys(EVENT_TYPE).filter((k) => d['ev_' + k]), options, images: (d.images || '').split('\n').map((x) => x.trim()).filter(Boolean), featured: !!d.featured, active: !!d.active };
  await api(f.dataset.id ? '/provider/services/' + f.dataset.id : '/provider/services', { method: f.dataset.id ? 'PATCH' : 'POST', body });
  closeDialog(); toast('Serviço salvo!'); location.reload();
});
act('svc-toggle', async (el) => { await api('/provider/services/' + el.dataset.id, { method: 'PATCH', body: { active: el.checked } }); toast(el.checked ? 'Serviço ativado.' : 'Serviço desativado.'); });
act('svc-del', async (el) => { const r = await api('/provider/services/' + el.dataset.id, { method: 'DELETE' }); toast(r.deactivated ? 'O serviço tem histórico e foi apenas desativado.' : 'Serviço removido.'); location.reload(); });

// ---------------- agenda ----------------
route('/fornecedor/agenda', async (ctx) => {
  const a = await api('/provider/agenda?month=' + (ctx.query.month || '')); ctx.title = 'Agenda';
  const [y, m] = a.month.split('-').map(Number), first = new Date(Date.UTC(y, m - 1, 1)), days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const prev = new Date(Date.UTC(y, m - 2, 1)).toISOString().slice(0, 7), next = new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 7);
  const cells = []; for (let i = 0; i < first.getUTCDay(); i++) cells.push(html`<div style="border:0;background:none"></div>`);
  for (let d = 1; d <= days; d++) { const ds = `${a.month}-${String(d).padStart(2, '0')}`, blk = a.blocks.find((b) => b.date === ds), bk = a.bookings.filter((b) => b.date === ds); cells.push(html`<button type="button" class="${blk ? 'blk' : bk.length ? 'bk' : ''}" data-act="day-toggle" data-date="${ds}" data-blocked="${blk ? 1 : 0}" aria-label="${d} — ${blk ? 'bloqueado' : bk.length ? bk.length + ' reserva(s)' : 'livre'}. Ativar/desativar bloqueio"><strong>${d}</strong><br>${blk ? '🚫 Bloqueado' : ''}${bk.length ? html`📅 ${bk.length}/${a.capacity}` : ''}</button>`); }
  return html`<div class="wrap page"><h1>Agenda</h1>${tabs('/fornecedor/agenda')}<div class="row between"><a class="btn ghost sm" href="#/fornecedor/agenda?month=${prev}">← Mês anterior</a><strong>${new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' })}</strong><a class="btn ghost sm" href="#/fornecedor/agenda?month=${next}">Próximo mês →</a></div>
  <p class="meta">Clique em um dia para bloqueá-lo ou liberá-lo. 📅 mostra reservas confirmadas (pagas) sobre a capacidade diária de ${a.capacity} evento(s). Capacidade e prazo mínimo são definidos em <a href="#/fornecedor/perfil">Perfil</a>.</p>
  <div class="cal" role="group" aria-label="Calendário">${['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((d) => html`<div class="h">${d}</div>`)}${cells}</div></div>`;
}, R);
act('day-toggle', async (el) => { const blocked = el.dataset.blocked === '1'; await api('/provider/blocks', { method: 'PUT', body: { date: el.dataset.date, blocked: !blocked, reason: 'Bloqueado pelo fornecedor' } }); toast(blocked ? 'Data liberada.' : 'Data bloqueada.'); location.reload(); });

// ---------------- avaliações / financeiro ----------------
route('/fornecedor/avaliacoes', async (ctx) => {
  const rs = await api('/provider/reviews'); ctx.title = 'Avaliações';
  return html`<div class="wrap page"><h1>Avaliações</h1>${tabs('/fornecedor/avaliacoes')}${rs.length ? rs.map((r) => html`<div class="card pad" style="margin-bottom:10px"><div class="row between"><strong>${r.author}</strong><span class="stars">${'★'.repeat(r.rating)}${'☆'.repeat(5 - r.rating)}</span><span class="tag ${r.status === 'publicada' ? 'ok' : 'warn'}">${r.status}</span></div><p>${r.comment || ''}</p>${r.reply ? html`<div class="notice info"><strong>Sua resposta:</strong> ${r.reply}</div>` : html`<form class="inline" data-form="reply" data-id="${r.id}">${field('Responder', 'reply', { required: true })}<button class="btn sm" type="submit">Publicar resposta</button></form>`}</div>`) : empty('⭐', 'Sem avaliações ainda', 'Clientes só avaliam depois de contratações concluídas.')}</div>`;
}, R);
form('reply', async (d, f) => { await api(`/provider/reviews/${f.dataset.id}/reply`, { method: 'POST', body: d }); toast('Resposta publicada.'); location.reload(); });
route('/fornecedor/financeiro', async (ctx) => {
  const ps = await api('/provider/payouts'); ctx.title = 'Financeiro';
  const sum = (s) => ps.filter((p) => p.status === s).reduce((t, p) => t + p.amount_cents, 0);
  return html`<div class="wrap page"><h1>Financeiro</h1>${tabs('/fornecedor/financeiro')}<div class="kpis"><div class="kpi"><b>${money(sum('pendente'))}</b><span>Repasses pendentes</span></div><div class="kpi"><b>${money(sum('pago'))}</b><span>Repasses pagos</span></div></div>
  <p class="meta">Repasses são liberados após a conclusão do pedido, sem disputa. O valor já é líquido da comissão da plataforma. Em produção, o prazo segue as regras do provedor de pagamentos.</p>
  ${ps.length ? table(['Pedido', 'Evento', 'Valor líquido', 'Status', 'Pago em'], ps.map((p) => [html`<a href="#/fornecedor/pedidos/${p.order_id}">#${p.order_id}</a>`, fmtDate(p.event_date), money(p.amount_cents), p.status, p.paid_at ? fmtDate(p.paid_at) : '—'])) : empty('💰', 'Sem repasses ainda', 'Eles aparecem quando você concluir pedidos.')}</div>`;
}, R);

// ---------------- perfil, áreas e portfólio ----------------
route('/fornecedor/perfil', async (ctx) => {
  const d = await api('/provider/me'), p = d.provider; ctx.title = 'Perfil';
  const label = (a) => a.type === 'cidade' ? `Cidade: ${(state.config.cities.find((c) => c.slug === a.city_slug) || {}).name || a.city_slug}` : a.type === 'bairro' ? `Bairro: ${a.neighborhood} (${(state.config.cities.find((c) => c.slug === a.city_slug) || {}).name})` : a.type === 'cep' ? `CEPs ${String(a.cep_from).padStart(5, '0')} a ${String(a.cep_to).padStart(5, '0')}` : `Raio de ${a.radius_km} km`;
  window.__areas = d.areas;
  return html`<div class="wrap page"><h1>Perfil e áreas atendidas</h1>${tabs('/fornecedor/perfil')}${notApproved()}
  <form class="card pad grid" data-form="prov-save"><h2>Dados comerciais</h2>${field('Nome comercial', 'name', { value: p.name, required: true })}${field('Descrição', 'description', { type: 'textarea', value: p.description, required: true })}
  <div class="cols">${field('Cidade', 'city', { value: p.city, required: true })}${field('UF', 'state', { value: p.state, attrs: 'maxlength="2"', required: true })}${field('Bairro', 'neighborhood', { value: p.neighborhood })}</div>${field('Endereço', 'address', { value: p.address })}
  <div class="cols">${field('Telefone', 'phone', { value: p.phone })}${field('Horários', 'hours', { value: p.hours })}</div>
  <h3>Agenda e deslocamento</h3><div class="cols">${field('Prazo mínimo (dias)', 'min_notice_days', { type: 'number', value: p.min_notice_days, attrs: 'min="0"' })}${field('Eventos por dia (capacidade)', 'capacity_per_day', { type: 'number', value: p.capacity_per_day, attrs: 'min="1"' })}${field('Taxa de deslocamento (R$)', 'travel', { value: centsToInput(p.travel_fee_cents), attrs: 'inputmode="decimal"', hint: 'Cobrada quando o evento é fora da sua cidade.' })}</div>${field('Regra de deslocamento', 'travel_policy', { value: p.travel_policy })}
  <div class="field"><label for="f-cover_url">Imagem de capa (URL)</label><input id="f-cover_url" name="cover_url" value="${p.cover_url || ''}"><input type="file" accept="image/jpeg,image/png,image/webp" data-upload="f-cover_url" aria-label="Enviar capa"></div>
  <div class="field"><label for="f-logo_url">Logo ou foto (URL)</label><input id="f-logo_url" name="logo_url" value="${p.logo_url || ''}"><input type="file" accept="image/jpeg,image/png,image/webp" data-upload="f-logo_url" aria-label="Enviar logo"></div>
  <div class="notice info">Plano: <strong>${p.plan === 'premium' ? 'Premium' : 'Básico'}</strong> · Comissão da plataforma: <strong>${(p.commission_bps_effective / 100).toLocaleString('pt-BR')}%</strong> por pedido, sem mensalidade. Você vê o valor líquido antes de aceitar cada pedido.</div>${errBox()}<button class="btn" type="submit">Salvar perfil</button></form>
  <section class="section card pad"><h2>Áreas atendidas</h2><p class="meta">Clientes só encontram você se estiverem dentro de uma destas áreas.</p>${d.areas.length ? html`<ul>${d.areas.map((a, i) => html`<li>${label(a)} <button class="btn ghost sm" data-act="area-del" data-i="${i}">Remover</button></li>`)}</ul>` : '<p class="notice">Nenhuma área cadastrada: você não aparece nas buscas por local.</p>'}
  <form class="grid" data-form="area-add"><div class="cols">${field('Tipo', 'type', { type: 'select', options: [['cidade', 'Cidade inteira'], ['bairro', 'Bairro'], ['cep', 'Faixa de CEP'], ['raio', 'Raio a partir do meu endereço']] })}${field('Cidade', 'city', { type: 'select', options: cityOpts() })}${field('Bairro', 'neighborhood')}${field('CEP inicial (5 dígitos)', 'cep_from', { attrs: 'maxlength="5"' })}${field('CEP final (5 dígitos)', 'cep_to', { attrs: 'maxlength="5"' })}${field('Raio (km)', 'radius_km', { type: 'number', attrs: 'min="1"' })}</div>${errBox()}<button class="btn ghost" type="submit">Adicionar área</button></form></section>
  <section class="section card pad"><h2>Portfólio</h2><div class="gallery">${d.media.map((m) => html`<figure style="margin:0">${m.type === 'imagem' ? html`<img src="${m.url}" alt="${m.caption || 'Foto do portfólio'}">` : html`<a href="${m.url}" target="_blank" rel="noopener noreferrer">🎬 ${m.caption || m.url}</a>`}<figcaption class="meta">${m.hidden ? '🚫 oculta pela moderação · ' : ''}<button class="btn danger sm" data-act="media-del" data-id="${m.id}">Remover</button></figcaption></figure>`)}</div>
  <form class="grid" data-form="media-add"><div class="cols">${field('Tipo', 'type', { type: 'select', options: [['imagem', 'Foto'], ['video', 'Vídeo (link https)']] })}${field('Legenda', 'caption')}</div><div class="field"><label for="f-media_url">Endereço da mídia</label><input id="f-media_url" name="url" required><input type="file" accept="image/jpeg,image/png,image/webp" data-upload="f-media_url" aria-label="Enviar foto"></div>${errBox()}<button class="btn ghost" type="submit">Adicionar ao portfólio</button></form></section></div>`;
}, R);
form('prov-save', async (d) => {
  const travel = d.travel ? toCents(d.travel) : 0; if (Number.isNaN(travel)) throw new Error('Taxa de deslocamento inválida.');
  await api('/provider/me', { method: 'PATCH', body: { ...d, travel_fee_cents: travel, min_notice_days: Number(d.min_notice_days), capacity_per_day: Number(d.capacity_per_day) } }); toast('Perfil salvo.');
});
const saveAreas = async (areas) => { await api('/provider/areas', { method: 'PUT', body: { areas } }); toast('Áreas atualizadas.'); location.reload(); };
form('area-add', (d) => { const a = { type: d.type, city: state.config.cities.find((c) => c.name === d.city)?.name, neighborhood: d.neighborhood, cep_from: d.cep_from, cep_to: d.cep_to, radius_km: d.radius_km }; return saveAreas([...window.__areas.map((x) => ({ ...x, city: (state.config.cities.find((c) => c.slug === x.city_slug) || {}).name })), a]); });
act('area-del', (el) => saveAreas(window.__areas.filter((_, i) => i !== Number(el.dataset.i)).map((x) => ({ ...x, city: (state.config.cities.find((c) => c.slug === x.city_slug) || {}).name }))));
form('media-add', async (d) => { await api('/provider/media', { method: 'POST', body: d }); toast('Adicionado ao portfólio (sujeito a moderação).'); location.reload(); });
act('media-del', async (el) => { await api('/provider/media/' + el.dataset.id, { method: 'DELETE' }); location.reload(); });

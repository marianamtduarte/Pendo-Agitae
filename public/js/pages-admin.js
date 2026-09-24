import { api, state, html, raw, route, act, form, field, empty, table, money, fmtDate, fmtDateTime, statusTag, priceKind, toast, go, openDialog, closeDialog, errBox, toCents } from './core.js';
import { orderPage } from './pages-client.js';

const R = { auth: true, role: 'admin' };
const TABS = [['/admin', 'Indicadores'], ['/admin/fornecedores', 'Fornecedores'], ['/admin/servicos', 'Serviços e mídias'], ['/admin/avaliacoes', 'Avaliações'], ['/admin/pedidos', 'Pedidos e disputas'], ['/admin/pagamentos', 'Pagamentos e repasses'], ['/admin/categorias', 'Categorias'], ['/admin/cupons', 'Cupons e banners'], ['/admin/usuarios', 'Usuários'], ['/admin/config', 'Configurações'], ['/admin/auditoria', 'Auditoria']];
const tabs = (cur) => html`<nav class="tabs" aria-label="Administração">${TABS.map(([h, l]) => html`<a href="#${h}" ${h === cur ? raw('aria-current="page"') : ''}>${l}</a>`)}</nav>`;
const page = (cur, title, body) => html`<div class="wrap page"><h1>${title}</h1>${tabs(cur)}${body}</div>`;
const pct = (bps) => (bps / 100).toLocaleString('pt-BR') + '%';

route('/admin', async (ctx) => {
  const m = await api('/admin/metrics'); ctx.title = 'Administração';
  return page('/admin', 'Administração', html`<div class="kpis"><div class="kpi"><b>${m.active_providers}</b><span>Fornecedores ativos</span></div><div class="kpi"><b>${m.pending_providers}</b><span>Aguardando aprovação</span></div><div class="kpi"><b>${m.requests}</b><span>Solicitações (pedidos + orçamentos)</span></div><div class="kpi"><b>${m.conversion}%</b><span>Conversão em pedido pago</span></div>
  <div class="kpi"><b>${money(m.gmv_cents)}</b><span>Volume contratado (${m.orders_paid} pedidos)</span></div><div class="kpi"><b>${money(m.commission_cents)}</b><span>Receita de comissão</span></div><div class="kpi"><b>${m.open_disputes}</b><span>Disputas abertas</span></div><div class="kpi"><b>${m.pending_reviews}</b><span>Avaliações a moderar</span></div><div class="kpi"><b>${m.users}</b><span>Usuários</span></div></div>
  <section class="section"><h2>Categorias mais procuradas</h2>${m.top_categories.length ? table(['Categoria', 'Interações'], m.top_categories.map((c) => [c.name, c.n])) : '<p class="meta">Sem dados ainda.</p>'}</section>`);
}, R);

route('/admin/fornecedores', async (ctx) => {
  const ps = await api('/admin/providers' + (ctx.query.status ? '?status=' + ctx.query.status : '')); ctx.title = 'Fornecedores';
  return page('/admin/fornecedores', 'Fornecedores', html`<p class="row">Filtrar: ${['', 'pendente', 'aprovado', 'suspenso', 'rejeitado'].map((s) => html`<a class="chip" href="#/admin/fornecedores${s ? '?status=' + s : ''}">${s || 'todos'}</a>`)}</p>
  ${table(['Fornecedor', 'Cidade', 'Status', 'Plano / comissão', 'Serviços', 'Ações'], ps.map((p) => [html`<strong>${p.name}</strong><br><span class="meta">${p.owner_email}</span>${p.verified ? html` <span class="tag ok">verificado</span>` : ''}`, `${p.city}/${p.state}`, html`<span class="tag ${p.status === 'aprovado' ? 'ok' : p.status === 'pendente' ? 'warn' : 'bad'}">${p.status}</span>`, html`${p.plan}<br><span class="meta">${p.commission_bps == null ? 'padrão' : pct(p.commission_bps)}</span>`, p.services,
    html`<div class="row">${p.status !== 'aprovado' ? html`<button class="btn sm" data-act="prov-set" data-id="${p.id}" data-status="aprovado">Aprovar</button>` : ''}${p.status === 'aprovado' ? html`<button class="btn danger sm" data-act="prov-set" data-id="${p.id}" data-status="suspenso" data-confirm="Suspender este fornecedor?">Suspender</button>` : ''}${p.status === 'pendente' ? html`<button class="btn danger sm" data-act="prov-set" data-id="${p.id}" data-status="rejeitado" data-confirm="Rejeitar cadastro?">Rejeitar</button>` : ''}<button class="btn ghost sm" data-act="prov-verify" data-id="${p.id}" data-v="${p.verified ? 0 : 1}">${p.verified ? 'Remover selo' : 'Verificar'}</button><button class="btn ghost sm" data-act="prov-edit" data-id="${p.id}" data-plan="${p.plan}" data-bps="${p.commission_bps ?? ''}">Plano/comissão</button><a class="btn ghost sm" href="#/f/${p.slug}">Ver perfil</a></div>`]))}`);
}, R);
const setProv = async (id, body) => { await api('/admin/providers/' + id, { method: 'POST', body }); toast('Fornecedor atualizado.'); location.reload(); };
act('prov-set', (el) => setProv(el.dataset.id, { status: el.dataset.status }));
act('prov-verify', (el) => setProv(el.dataset.id, { verified: el.dataset.v === '1' }));
act('prov-edit', (el) => openDialog('Plano e comissão', html`<form class="grid" data-form="prov-plan" data-id="${el.dataset.id}">${field('Plano', 'plan', { type: 'select', value: el.dataset.plan, options: [['basico', 'Básico'], ['premium', 'Premium (selo e destaque)']] })}${field('Comissão específica (pontos-base: 750 = 7,5%)', 'commission_bps', { type: 'number', value: el.dataset.bps, attrs: 'min="0" max="5000"', hint: 'Deixe em branco para usar a comissão padrão do plano (Configurações).' })}${errBox()}<button class="btn" type="submit">Salvar</button></form>`));
form('prov-plan', (d, f) => setProv(f.dataset.id, { plan: d.plan, commission_bps: d.commission_bps === '' ? null : Number(d.commission_bps) }));

route('/admin/servicos', async (ctx) => {
  const [ss, ms] = await Promise.all([api('/admin/services'), api('/admin/media')]); ctx.title = 'Moderação';
  return page('/admin/servicos', 'Serviços e mídias', html`<h2>Serviços</h2>${table(['Serviço', 'Fornecedor', 'Categoria', 'Preço', 'Status', ''], ss.map((s) => [s.name, s.provider_name, s.cat_name, s.price_type === 'orcamento' ? 'Sob orçamento' : money(s.price_cents), s.hidden ? html`<span class="tag bad">oculto</span>` : html`<span class="tag ok">visível</span>`, html`<button class="btn ghost sm" data-act="svc-hide" data-id="${s.id}" data-hide="${s.hidden ? 0 : 1}">${s.hidden ? 'Liberar' : 'Ocultar'}</button>`]))}
  <section class="section"><h2>Fotos e vídeos do portfólio</h2><div class="gallery">${ms.map((m) => html`<figure style="margin:0">${m.type === 'imagem' ? html`<img src="${m.url}" alt="${m.caption || 'Mídia do portfólio'}">` : html`<a href="${m.url}" target="_blank" rel="noopener noreferrer">🎬 vídeo</a>`}<figcaption class="meta">${m.provider_name} ${m.hidden ? '· oculta' : ''}<br><button class="btn ghost sm" data-act="media-hide" data-id="${m.id}" data-hide="${m.hidden ? 0 : 1}">${m.hidden ? 'Liberar' : 'Ocultar'}</button></figcaption></figure>`)}</div></section>`);
}, R);
act('svc-hide', async (el) => { await api(`/admin/services/${el.dataset.id}/hide`, { method: 'POST', body: { hidden: el.dataset.hide === '1' } }); location.reload(); });
act('media-hide', async (el) => { await api(`/admin/media/${el.dataset.id}/hide`, { method: 'POST', body: { hidden: el.dataset.hide === '1' } }); location.reload(); });

route('/admin/avaliacoes', async (ctx) => {
  const rs = await api('/admin/reviews'); ctx.title = 'Avaliações';
  return page('/admin/avaliacoes', 'Moderação de avaliações', rs.length ? table(['Fornecedor', 'Autor', 'Nota', 'Comentário', 'Status', ''], rs.map((r) => [r.provider_name, r.author, '★'.repeat(r.rating), r.comment || '', html`<span class="tag ${r.status === 'publicada' ? 'ok' : r.status === 'pendente' ? 'warn' : 'bad'}">${r.status}</span>`, html`<div class="row">${r.status !== 'publicada' ? html`<button class="btn sm" data-act="rev-set" data-id="${r.id}" data-st="publicada">Publicar</button>` : ''}${r.status !== 'rejeitada' ? html`<button class="btn danger sm" data-act="rev-set" data-id="${r.id}" data-st="rejeitada">Rejeitar</button>` : ''}</div>`])) : empty('⭐', 'Nenhuma avaliação', ''));
}, R);
act('rev-set', async (el) => { await api('/admin/reviews/' + el.dataset.id, { method: 'POST', body: { status: el.dataset.st } }); toast('Avaliação atualizada.'); location.reload(); });

route('/admin/pedidos', async (ctx) => {
  const os = await api('/admin/orders' + (ctx.query.status ? '?status=' + ctx.query.status : '')); ctx.title = 'Pedidos';
  return page('/admin/pedidos', 'Pedidos e disputas', html`<p class="row">Filtrar: ${['', 'em_disputa', 'aguardando_pagamento', 'confirmado', 'concluido', 'cancelado'].map((s) => html`<a class="chip" href="#/admin/pedidos${s ? '?status=' + s : ''}">${s || 'todos'}</a>`)}</p>
  ${table(['#', 'Cliente', 'Fornecedor', 'Evento', 'Total', 'Comissão', 'Status', ''], os.map((o) => [o.id, o.customer_name, o.provider_name, fmtDate(o.event_date), money(o.total_cents), money(o.commission_cents), statusTag(o.status), html`<div class="row"><a class="btn ghost sm" href="#/admin/pedidos/${o.id}">Ver</a>${o.status === 'em_disputa' ? html`<button class="btn sm" data-act="dispute-open" data-id="${o.id}">Resolver</button>` : ''}</div>`]))}`);
}, R);
route('/admin/pedidos/:id', (ctx) => orderPage(ctx, '#/admin/pedidos'), R);
act('dispute-open', (el) => openDialog('Resolver disputa #' + el.dataset.id, html`<form class="grid" data-form="dispute-resolve" data-id="${el.dataset.id}">${field('Decisão', 'resolution', { type: 'select', options: [['reembolsar', 'Reembolsar o cliente (integral)'], ['liberar', 'Liberar o pagamento ao fornecedor']] })}${field('Justificativa (registrada na auditoria)', 'note', { type: 'textarea', required: true })}${errBox()}<button class="btn" type="submit">Confirmar decisão</button></form>`));
form('dispute-resolve', async (d, f) => { await api(`/admin/orders/${f.dataset.id}/resolve`, { method: 'POST', body: d }); closeDialog(); toast('Disputa resolvida.'); location.reload(); });

route('/admin/pagamentos', async (ctx) => {
  const d = await api('/admin/payments'); ctx.title = 'Pagamentos';
  return page('/admin/pagamentos', 'Pagamentos e repasses', html`<div class="notice info">Valores e status refletem o provedor de pagamentos (${state.config.payment_mode === 'test' ? 'AMBIENTE DE TESTE — simulado' : 'produção'}). A Agitaê não armazena dados de cartão.</div>
  <h2>Pagamentos</h2>${table(['#', 'Pedido', 'Valor', 'Método', 'Status', 'Estornado', 'Data'], d.payments.map((p) => [p.id, `#${p.order_id}`, money(p.amount_cents), p.method || '—', p.status, p.refunded_cents ? money(p.refunded_cents) : '—', fmtDateTime(p.created_at)]))}
  <section class="section"><h2>Repasses</h2>${table(['#', 'Fornecedor', 'Pedido', 'Valor', 'Status', ''], d.payouts.map((p) => [p.id, p.provider_name, `#${p.order_id}`, money(p.amount_cents), p.status, p.status === 'pendente' ? html`<button class="btn sm" data-act="payout-pay" data-id="${p.id}">Liberar (teste)</button>` : p.paid_at ? fmtDate(p.paid_at) : '']))}</section>`);
}, R);
act('payout-pay', async (el) => { await api(`/admin/payouts/${el.dataset.id}/pay`, { method: 'POST' }); toast('Repasse liberado (modo teste).'); location.reload(); });

route('/admin/categorias', async (ctx) => {
  const cs = await api('/admin/categories'); ctx.title = 'Categorias';
  return page('/admin/categorias', 'Categorias', html`<p class="meta">Novas categorias aparecem automaticamente na home, nas buscas e no cadastro de serviços — sem alterar código.</p>${table(['Ícone', 'Nome', 'Identificador', 'Posição', 'Ativa'], cs.map((c) => [c.icon, c.name, c.slug, c.position, html`<label class="check"><input type="checkbox" data-act="cat-toggle" data-id="${c.id}" ${c.active ? 'checked' : ''} aria-label="Ativar ${c.name}"> ${c.active ? 'Sim' : 'Não'}</label>`]))}
  <form class="card pad grid" style="margin-top:16px" data-form="cat-new"><h3>Nova categoria</h3><div class="cols">${field('Nome', 'name', { required: true })}${field('Ícone (emoji)', 'icon', { value: '🎉' })}${field('Posição', 'position', { type: 'number', value: cs.length + 1 })}</div>${field('Descrição', 'description')}${errBox()}<button class="btn" type="submit">Criar categoria</button></form>`);
}, R);
act('cat-toggle', async (el) => { await api('/admin/categories/' + el.dataset.id, { method: 'PATCH', body: { active: el.checked } }); toast('Categoria atualizada.'); const c = await api('/config'); state.config = c; });
form('cat-new', async (d) => { await api('/admin/categories', { method: 'POST', body: { ...d, position: Number(d.position) } }); state.config = await api('/config'); toast('Categoria criada.'); location.reload(); });

route('/admin/cupons', async (ctx) => {
  const [cs, bs] = await Promise.all([api('/admin/coupons'), api('/admin/banners')]); ctx.title = 'Cupons e banners';
  return page('/admin/cupons', 'Cupons e banners', html`<h2>Cupons</h2>${table(['Código', 'Desconto', 'Usos', 'Validade', 'Ativo'], cs.map((c) => [c.code, c.kind === 'percentual' ? c.value + '%' : money(c.value), `${c.uses}${c.max_uses ? '/' + c.max_uses : ''}`, c.expires_at ? fmtDate(c.expires_at) : '—', html`<label class="check"><input type="checkbox" data-act="coupon-toggle" data-id="${c.id}" ${c.active ? 'checked' : ''} aria-label="Ativar ${c.code}"> ${c.active ? 'Sim' : 'Não'}</label>`]))}
  <form class="card pad grid" style="margin:12px 0" data-form="coupon-new"><h3>Novo cupom</h3><div class="cols">${field('Código', 'code', { required: true })}${field('Tipo', 'kind', { type: 'select', options: [['percentual', 'Percentual (%)'], ['fixo', 'Valor fixo (R$)']] })}${field('Valor (% ou R$)', 'value', { required: true, attrs: 'inputmode="decimal"' })}${field('Validade', 'expires_at', { type: 'date' })}${field('Limite de usos', 'max_uses', { type: 'number', attrs: 'min="1"' })}</div>${errBox()}<button class="btn" type="submit">Criar cupom</button></form>
  <h2>Banners da home</h2>${table(['Título', 'Texto', 'Link', 'Ativo', ''], bs.map((b) => [b.title, b.text || '', b.link || '', html`<label class="check"><input type="checkbox" data-act="banner-toggle" data-id="${b.id}" ${b.active ? 'checked' : ''} aria-label="Ativar ${b.title}"> ${b.active ? 'Sim' : 'Não'}</label>`, html`<button class="btn danger sm" data-act="banner-del" data-id="${b.id}" data-confirm="Remover banner?">Remover</button>`]))}
  <form class="card pad grid" style="margin-top:12px" data-form="banner-new"><h3>Novo banner</h3><div class="cols">${field('Título', 'title', { required: true })}${field('Texto', 'text')}${field('Link (ex.: #/busca)', 'link')}</div>${errBox()}<button class="btn" type="submit">Criar banner</button></form>`);
}, R);
form('coupon-new', async (d) => { const value = d.kind === 'fixo' ? toCents(d.value) : Number(d.value); await api('/admin/coupons', { method: 'POST', body: { code: d.code, kind: d.kind, value, expires_at: d.expires_at || null, max_uses: d.max_uses ? Number(d.max_uses) : null } }); toast('Cupom criado.'); location.reload(); });
act('coupon-toggle', async (el) => { await api('/admin/coupons/' + el.dataset.id, { method: 'PATCH', body: { active: el.checked } }); toast('Cupom atualizado.'); });
form('banner-new', async (d) => { await api('/admin/banners', { method: 'POST', body: d }); state.config = await api('/config'); toast('Banner criado.'); location.reload(); });
act('banner-toggle', async (el) => { await api('/admin/banners/' + el.dataset.id, { method: 'PATCH', body: { active: el.checked } }); state.config = await api('/config'); });
act('banner-del', async (el) => { await api('/admin/banners/' + el.dataset.id, { method: 'DELETE' }); state.config = await api('/config'); location.reload(); });

route('/admin/usuarios', async (ctx) => {
  const us = await api('/admin/users'); ctx.title = 'Usuários';
  return page('/admin/usuarios', 'Usuários', table(['Nome', 'E-mail', 'Papéis', 'Criado em', ''], us.map((u) => [u.name, u.email, u.roles.split(',').join(', '), fmtDate(u.created_at), u.deleted_at ? 'removido' : html`<button class="btn ghost sm" data-act="user-admin" data-id="${u.id}" data-roles="${u.roles}">${u.roles.includes('admin') ? 'Remover admin' : 'Tornar admin'}</button>`])));
}, R);
act('user-admin', async (el) => { const roles = el.dataset.roles.split(','); const next = roles.includes('admin') ? roles.filter((r) => r !== 'admin') : [...roles, 'admin']; await api('/admin/users/' + el.dataset.id, { method: 'POST', body: { roles: next } }); toast('Papéis atualizados.'); location.reload(); });

route('/admin/config', async (ctx) => {
  const s = await api('/admin/settings'); ctx.title = 'Configurações';
  return page('/admin/config', 'Configurações comerciais', html`<form class="card pad grid" style="max-width:560px" data-form="settings"><p class="meta">Valores em pontos-base (100 = 1%). Não são fixos no código: a alteração vale para novos pedidos; pedidos existentes mantêm a comissão com que foram criados.</p>
  ${field('Comissão padrão — plano Básico (750 = 7,5%)', 'commission_bps', { type: 'number', value: s.commission_bps, attrs: 'min="0" max="5000"' })}${field('Comissão — plano Premium (700 = 7%)', 'premium_commission_bps', { type: 'number', value: s.premium_commission_bps, attrs: 'min="0" max="5000"' })}${field('Taxa de serviço ao cliente (0 = sem taxa)', 'customer_fee_bps', { type: 'number', value: s.customer_fee_bps, attrs: 'min="0" max="5000"' })}
  <p>Modo de pagamentos: <strong>${s.payment_mode}</strong> <span class="meta">(definido por variável de ambiente)</span></p>${errBox()}<button class="btn" type="submit">Salvar</button></form>`);
}, R);
form('settings', async (d) => { await api('/admin/settings', { method: 'PUT', body: { commission_bps: Number(d.commission_bps), premium_commission_bps: Number(d.premium_commission_bps), customer_fee_bps: Number(d.customer_fee_bps) } }); toast('Configurações salvas e registradas na auditoria.'); });

route('/admin/auditoria', async (ctx) => {
  const a = await api('/admin/audit'); ctx.title = 'Auditoria';
  return page('/admin/auditoria', 'Registro de alterações', table(['Quando', 'Quem', 'Ação', 'Entidade', 'Detalhes'], a.map((x) => [fmtDateTime(x.created_at), x.actor || 'sistema', x.action, x.entity ? `${x.entity} #${x.entity_id ?? ''}` : '—', html`<code>${x.detail || ''}</code>`])));
}, R);

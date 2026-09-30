import { api, state, html, raw, route, act, form, field, empty, table, money, fmtDate, fmtDateTime, statusTag, toast, go, openDialog, closeDialog, errBox, toCents, t } from './core.js';
import { orderPage } from './pages-client.js';

const R = { auth: true, role: 'admin' };
const TABS = () => [['/admin', t('Indicadores')], ['/admin/fornecedores', t('Fornecedores')], ['/admin/servicos', t('Serviços e mídias')], ['/admin/avaliacoes', t('Avaliações')], ['/admin/pedidos', t('Pedidos e disputas')], ['/admin/pagamentos', t('Pagamentos e repasses')], ['/admin/categorias', t('Categorias')], ['/admin/cupons', t('Cupons e banners')], ['/admin/usuarios', t('Usuários')], ['/admin/config', t('Configurações')], ['/admin/auditoria', t('Auditoria')]];
const tabs = (cur) => html`<nav class="tabs" aria-label="${t('Administração')}">${TABS().map(([h, l]) => html`<a href="#${h}" ${h === cur ? raw('aria-current="page"') : ''}>${l}</a>`)}</nav>`;
const page = (cur, title, body) => html`<div class="wrap page dash"><h1>${title}</h1>${tabs(cur)}${body}</div>`;
const pct = (bps) => (bps / 100).toLocaleString('pt-BR') + '%';
const PST = () => ({ pendente: t('pendente'), aprovado: t('aprovado'), suspenso: t('suspenso'), rejeitado: t('rejeitado') });

route('/admin', async (ctx) => {
  const m = await api('/admin/metrics'); ctx.title = t('Administração');
  return page('/admin', t('Administração'), html`<div class="kpis"><div class="kpi"><b>${m.active_providers}</b><span>${t('Fornecedores ativos')}</span></div><div class="kpi"><b>${m.pending_providers}</b><span>${t('Aguardando aprovação')}</span></div><div class="kpi"><b>${m.requests}</b><span>${t('Solicitações (pedidos + orçamentos)')}</span></div><div class="kpi"><b>${m.conversion}%</b><span>${t('Conversão em pedido pago')}</span></div>
  <div class="kpi"><b>${money(m.gmv_cents)}</b><span>${t('Volume contratado ({n} pedidos)', { n: m.orders_paid })}</span></div><div class="kpi"><b>${money(m.commission_cents)}</b><span>${t('Receita de comissão')}</span></div><div class="kpi"><b>${m.open_disputes}</b><span>${t('Disputas abertas')}</span></div><div class="kpi"><b>${m.pending_reviews}</b><span>${t('Avaliações a moderar')}</span></div><div class="kpi"><b>${m.users}</b><span>${t('Usuários')}</span></div></div>
  <section class="section"><h2>${t('Categorias mais procuradas')}</h2>${m.top_categories.length ? table([t('Categoria'), t('Interações')], m.top_categories.map((c) => [c.name, c.n])) : `<p class="meta">${t('Sem dados ainda.')}</p>`}</section>`);
}, R);

route('/admin/fornecedores', async (ctx) => {
  const ps = await api('/admin/providers' + (ctx.query.status ? '?status=' + ctx.query.status : '')); ctx.title = t('Fornecedores');
  return page('/admin/fornecedores', t('Fornecedores'), html`<p class="row">${t('Filtrar')}: ${['', 'pendente', 'aprovado', 'suspenso', 'rejeitado'].map((s) => html`<a class="chip" href="#/admin/fornecedores${s ? '?status=' + s : ''}">${s ? PST()[s] : t('todos')}</a>`)}</p>
  ${table([t('Fornecedor'), t('Cidade'), t('Status'), t('Plano / comissão'), t('Serviços'), t('Ações')], ps.map((p) => [html`<strong>${p.name}</strong><br><span class="meta">${p.owner_email}</span>${p.verified ? html` <span class="tag ok">${t('verificado')}</span>` : ''}`, `${p.city}/${p.state}`, html`<span class="tag ${p.status === 'aprovado' ? 'ok' : p.status === 'pendente' ? 'warn' : 'bad'}">${PST()[p.status]}</span>`, html`${p.plan}<br><span class="meta">${p.commission_bps == null ? t('padrão') : pct(p.commission_bps)}</span>`, p.services,
    html`<div class="row">${p.status !== 'aprovado' ? html`<button class="btn sm" data-act="prov-set" data-id="${p.id}" data-status="aprovado">${t('Aprovar')}</button>` : ''}${p.status === 'aprovado' ? html`<button class="btn danger sm" data-act="prov-set" data-id="${p.id}" data-status="suspenso" data-confirm="${t('Suspender este fornecedor?')}">${t('Suspender')}</button>` : ''}${p.status === 'pendente' ? html`<button class="btn danger sm" data-act="prov-set" data-id="${p.id}" data-status="rejeitado" data-confirm="${t('Rejeitar cadastro?')}">${t('Rejeitar')}</button>` : ''}<button class="btn ghost sm" data-act="prov-verify" data-id="${p.id}" data-v="${p.verified ? 0 : 1}">${p.verified ? t('Remover selo') : t('Verificar')}</button><button class="btn ghost sm" data-act="prov-edit" data-id="${p.id}" data-plan="${p.plan}" data-bps="${p.commission_bps ?? ''}">${t('Plano/comissão')}</button><a class="btn ghost sm" href="#/f/${p.slug}">${t('Ver perfil')}</a></div>`]))}`);
}, R);
const setProv = async (id, body) => { await api('/admin/providers/' + id, { method: 'POST', body }); toast(t('Fornecedor atualizado.')); location.reload(); };
act('prov-set', (el) => setProv(el.dataset.id, { status: el.dataset.status }));
act('prov-verify', (el) => setProv(el.dataset.id, { verified: el.dataset.v === '1' }));
act('prov-edit', (el) => openDialog(t('Plano e comissão'), html`<form class="grid" data-form="prov-plan" data-id="${el.dataset.id}">${field(t('Plano'), 'plan', { type: 'select', value: el.dataset.plan, options: [['basico', t('Básico')], ['premium', t('Premium (selo e destaque)')]] })}${field(t('Comissão específica (pontos-base: 750 = 7,5%)'), 'commission_bps', { type: 'number', value: el.dataset.bps, attrs: 'min="0" max="5000"', hint: t('Deixe em branco para usar a comissão padrão do plano (Configurações).') })}${errBox()}<button class="btn" type="submit">${t('Salvar')}</button></form>`));
form('prov-plan', (d, f) => setProv(f.dataset.id, { plan: d.plan, commission_bps: d.commission_bps === '' ? null : Number(d.commission_bps) }));

route('/admin/servicos', async (ctx) => {
  const [ss, ms] = await Promise.all([api('/admin/services'), api('/admin/media')]); ctx.title = t('Moderação');
  return page('/admin/servicos', t('Serviços e mídias'), html`<h2>${t('Serviços')}</h2>${table([t('Serviço'), t('Fornecedor'), t('Categoria'), t('Preço'), t('Status'), ''], ss.map((s) => [s.name, s.provider_name, s.cat_name, s.price_type === 'orcamento' ? t('Sob orçamento') : money(s.price_cents), s.hidden ? html`<span class="tag bad">${t('oculto')}</span>` : html`<span class="tag ok">${t('visível')}</span>`, html`<button class="btn ghost sm" data-act="svc-hide" data-id="${s.id}" data-hide="${s.hidden ? 0 : 1}">${s.hidden ? t('Liberar') : t('Ocultar')}</button>`]))}
  <section class="section"><h2>${t('Fotos e vídeos do portfólio')}</h2><div class="gallery">${ms.map((m) => html`<figure style="margin:0">${m.type === 'imagem' ? html`<img src="${m.url}" alt="${m.caption || t('Mídia do portfólio')}">` : html`<a href="${m.url}" target="_blank" rel="noopener noreferrer">🎬 ${t('vídeo')}</a>`}<figcaption class="meta tiny">${m.provider_name} ${m.hidden ? '· ' + t('oculta') : ''}<br><button class="btn ghost sm" data-act="media-hide" data-id="${m.id}" data-hide="${m.hidden ? 0 : 1}">${m.hidden ? t('Liberar') : t('Ocultar')}</button></figcaption></figure>`)}</div></section>`);
}, R);
act('svc-hide', async (el) => { await api(`/admin/services/${el.dataset.id}/hide`, { method: 'POST', body: { hidden: el.dataset.hide === '1' } }); location.reload(); });
act('media-hide', async (el) => { await api(`/admin/media/${el.dataset.id}/hide`, { method: 'POST', body: { hidden: el.dataset.hide === '1' } }); location.reload(); });

route('/admin/avaliacoes', async (ctx) => {
  const rs = await api('/admin/reviews'); ctx.title = t('Avaliações');
  const st = { publicada: t('publicada'), pendente: t('pendente'), rejeitada: t('rejeitada') };
  return page('/admin/avaliacoes', t('Moderação de avaliações'), rs.length ? table([t('Fornecedor'), t('Autor'), t('Nota'), t('Comentário'), t('Status'), ''], rs.map((r) => [r.provider_name, r.author, '★'.repeat(r.rating), r.comment || '', html`<span class="tag ${r.status === 'publicada' ? 'ok' : r.status === 'pendente' ? 'warn' : 'bad'}">${st[r.status]}</span>`, html`<div class="row">${r.status !== 'publicada' ? html`<button class="btn sm" data-act="rev-set" data-id="${r.id}" data-st="publicada">${t('Publicar')}</button>` : ''}${r.status !== 'rejeitada' ? html`<button class="btn danger sm" data-act="rev-set" data-id="${r.id}" data-st="rejeitada">${t('Rejeitar')}</button>` : ''}</div>`])) : empty('⭐', t('Nenhuma avaliação'), ''));
}, R);
act('rev-set', async (el) => { await api('/admin/reviews/' + el.dataset.id, { method: 'POST', body: { status: el.dataset.st } }); toast(t('Avaliação atualizada.')); location.reload(); });

route('/admin/pedidos', async (ctx) => {
  const os = await api('/admin/orders' + (ctx.query.status ? '?status=' + ctx.query.status : '')); ctx.title = t('Pedidos');
  return page('/admin/pedidos', t('Pedidos e disputas'), html`<p class="row">${t('Filtrar')}: ${['', 'em_disputa', 'aguardando_pagamento', 'confirmado', 'concluido', 'cancelado'].map((s) => html`<a class="chip" href="#/admin/pedidos${s ? '?status=' + s : ''}">${s ? statusTag(s) : t('todos')}</a>`)}</p>
  ${table(['#', t('Cliente'), t('Fornecedor'), t('Evento'), t('Total'), t('Comissão'), t('Status'), ''], os.map((o) => [o.id, o.customer_name, o.provider_name, fmtDate(o.event_date), money(o.total_cents), money(o.commission_cents), statusTag(o.status), html`<div class="row"><a class="btn ghost sm" href="#/admin/pedidos/${o.id}">${t('Ver')}</a>${o.status === 'em_disputa' ? html`<button class="btn sm" data-act="dispute-open" data-id="${o.id}">${t('Resolver')}</button>` : ''}</div>`]))}`);
}, R);
route('/admin/pedidos/:id', (ctx) => orderPage(ctx, '#/admin/pedidos'), R);
act('dispute-open', (el) => openDialog(t('Resolver disputa #{n}', { n: el.dataset.id }), html`<form class="grid" data-form="dispute-resolve" data-id="${el.dataset.id}">${field(t('Decisão'), 'resolution', { type: 'select', options: [['reembolsar', t('Reembolsar o cliente (integral)')], ['liberar', t('Liberar o pagamento ao fornecedor')]] })}${field(t('Justificativa (registrada na auditoria)'), 'note', { type: 'textarea', required: true })}${errBox()}<button class="btn" type="submit">${t('Confirmar decisão')}</button></form>`));
form('dispute-resolve', async (d, f) => { await api(`/admin/orders/${f.dataset.id}/resolve`, { method: 'POST', body: d }); closeDialog(); toast(t('Disputa resolvida.')); location.reload(); });

route('/admin/pagamentos', async (ctx) => {
  const d = await api('/admin/payments'); ctx.title = t('Pagamentos');
  return page('/admin/pagamentos', t('Pagamentos e repasses'), html`<div class="notice info">${t('Valores e status refletem o provedor de pagamentos')} (${state.config.payment_mode === 'test' ? t('AMBIENTE DE TESTE — simulado') : t('produção')}). ${t('A Agitaê não armazena dados de cartão.')}</div>
  <h2>${t('Pagamentos')}</h2>${table(['#', t('Pedido'), t('Valor'), t('Método'), t('Status'), t('Estornado'), t('Data')], d.payments.map((p) => [p.id, `#${p.order_id}`, money(p.amount_cents), p.method || '—', p.status, p.refunded_cents ? money(p.refunded_cents) : '—', fmtDateTime(p.created_at)]))}
  <section class="section"><h2>${t('Repasses')}</h2>${table(['#', t('Fornecedor'), t('Pedido'), t('Valor'), t('Status'), ''], d.payouts.map((p) => [p.id, p.provider_name, `#${p.order_id}`, money(p.amount_cents), p.status, p.status === 'pendente' ? html`<button class="btn sm" data-act="payout-pay" data-id="${p.id}">${t('Liberar (teste)')}</button>` : p.paid_at ? fmtDate(p.paid_at) : '']))}</section>`);
}, R);
act('payout-pay', async (el) => { await api(`/admin/payouts/${el.dataset.id}/pay`, { method: 'POST' }); toast(t('Repasse liberado (modo teste).')); location.reload(); });

route('/admin/categorias', async (ctx) => {
  const cs = await api('/admin/categories'); ctx.title = t('Categorias');
  return page('/admin/categorias', t('Categorias'), html`<p class="meta">${t('Novas categorias aparecem automaticamente na home, nas buscas e no cadastro de serviços — sem alterar código.')}</p>${table([t('Ícone'), t('Nome'), t('Identificador'), t('Posição'), t('Ativa')], cs.map((c) => [c.icon, c.name, c.slug, c.position, html`<label class="check"><input type="checkbox" data-act="cat-toggle" data-id="${c.id}" ${c.active ? 'checked' : ''} aria-label="${t('Ativar {n}', { n: c.name })}"> ${c.active ? t('Sim') : t('Não')}</label>`]))}
  <form class="card pad grid" style="margin-top:18px" data-form="cat-new"><h3>${t('Nova categoria')}</h3><div class="cols">${field(t('Nome'), 'name', { required: true })}${field(t('Ícone (emoji)'), 'icon', { value: '🎉' })}${field(t('Posição'), 'position', { type: 'number', value: cs.length + 1 })}</div>${field(t('Descrição'), 'description')}${errBox()}<button class="btn" type="submit">${t('Criar categoria')}</button></form>`);
}, R);
act('cat-toggle', async (el) => { await api('/admin/categories/' + el.dataset.id, { method: 'PATCH', body: { active: el.checked } }); toast(t('Categoria atualizada.')); state.config = await api('/config'); });
form('cat-new', async (d) => { await api('/admin/categories', { method: 'POST', body: { ...d, position: Number(d.position) } }); state.config = await api('/config'); toast(t('Categoria criada.')); location.reload(); });

route('/admin/cupons', async (ctx) => {
  const [cs, bs] = await Promise.all([api('/admin/coupons'), api('/admin/banners')]); ctx.title = t('Cupons e banners');
  return page('/admin/cupons', t('Cupons e banners'), html`<h2>${t('Cupons')}</h2>${table([t('Código'), t('Desconto'), t('Usos'), t('Validade'), t('Ativo')], cs.map((c) => [c.code, c.kind === 'percentual' ? c.value + '%' : money(c.value), `${c.uses}${c.max_uses ? '/' + c.max_uses : ''}`, c.expires_at ? fmtDate(c.expires_at) : '—', html`<label class="check"><input type="checkbox" data-act="coupon-toggle" data-id="${c.id}" ${c.active ? 'checked' : ''} aria-label="${t('Ativar {n}', { n: c.code })}"> ${c.active ? t('Sim') : t('Não')}</label>`]))}
  <form class="card pad grid" style="margin:14px 0" data-form="coupon-new"><h3>${t('Novo cupom')}</h3><div class="cols">${field(t('Código'), 'code', { required: true })}${field(t('Tipo'), 'kind', { type: 'select', options: [['percentual', t('Percentual (%)')], ['fixo', t('Valor fixo (R$)')]] })}${field(t('Valor (% ou R$)'), 'value', { required: true, attrs: 'inputmode="decimal"' })}${field(t('Validade'), 'expires_at', { type: 'date' })}${field(t('Limite de usos'), 'max_uses', { type: 'number', attrs: 'min="1"' })}</div>${errBox()}<button class="btn" type="submit">${t('Criar cupom')}</button></form>
  <h2>${t('Banners da home')}</h2>${table([t('Título'), t('Texto'), t('Link'), t('Ativo'), ''], bs.map((b) => [b.title, b.text || '', b.link || '', html`<label class="check"><input type="checkbox" data-act="banner-toggle" data-id="${b.id}" ${b.active ? 'checked' : ''} aria-label="${t('Ativar {n}', { n: b.title })}"> ${b.active ? t('Sim') : t('Não')}</label>`, html`<button class="btn danger sm" data-act="banner-del" data-id="${b.id}" data-confirm="${t('Remover banner?')}">${t('Remover')}</button>`]))}
  <form class="card pad grid" style="margin-top:14px" data-form="banner-new"><h3>${t('Novo banner')}</h3><div class="cols">${field(t('Título'), 'title', { required: true })}${field(t('Texto'), 'text')}${field(t('Link (ex.: #/busca)'), 'link')}</div>${errBox()}<button class="btn" type="submit">${t('Criar banner')}</button></form>`);
}, R);
form('coupon-new', async (d) => { const value = d.kind === 'fixo' ? toCents(d.value) : Number(d.value); await api('/admin/coupons', { method: 'POST', body: { code: d.code, kind: d.kind, value, expires_at: d.expires_at || null, max_uses: d.max_uses ? Number(d.max_uses) : null } }); toast(t('Cupom criado.')); location.reload(); });
act('coupon-toggle', async (el) => { await api('/admin/coupons/' + el.dataset.id, { method: 'PATCH', body: { active: el.checked } }); toast(t('Cupom atualizado.')); });
form('banner-new', async (d) => { await api('/admin/banners', { method: 'POST', body: d }); state.config = await api('/config'); toast(t('Banner criado.')); location.reload(); });
act('banner-toggle', async (el) => { await api('/admin/banners/' + el.dataset.id, { method: 'PATCH', body: { active: el.checked } }); state.config = await api('/config'); });
act('banner-del', async (el) => { await api('/admin/banners/' + el.dataset.id, { method: 'DELETE' }); state.config = await api('/config'); location.reload(); });

route('/admin/usuarios', async (ctx) => {
  const us = await api('/admin/users'); ctx.title = t('Usuários');
  return page('/admin/usuarios', t('Usuários'), table([t('Nome'), t('E-mail'), t('Papéis'), t('Criado em'), ''], us.map((u) => [u.name, u.email, u.roles.split(',').join(', '), fmtDate(u.created_at), u.deleted_at ? t('removido') : html`<button class="btn ghost sm" data-act="user-admin" data-id="${u.id}" data-roles="${u.roles}">${u.roles.includes('admin') ? t('Remover admin') : t('Tornar admin')}</button>`])));
}, R);
act('user-admin', async (el) => { const roles = el.dataset.roles.split(','); const next = roles.includes('admin') ? roles.filter((r) => r !== 'admin') : [...roles, 'admin']; await api('/admin/users/' + el.dataset.id, { method: 'POST', body: { roles: next } }); toast(t('Papéis atualizados.')); location.reload(); });

route('/admin/config', async (ctx) => {
  const s = await api('/admin/settings'); ctx.title = t('Configurações');
  return page('/admin/config', t('Configurações comerciais'), html`<form class="card pad grid" style="max-width:600px" data-form="settings"><p class="meta">${t('Valores em pontos-base (100 = 1%). Não são fixos no código: a alteração vale para novos pedidos; pedidos existentes mantêm a comissão com que foram criados.')}</p>
  ${field(t('Comissão padrão — plano Básico (750 = 7,5%)'), 'commission_bps', { type: 'number', value: s.commission_bps, attrs: 'min="0" max="5000"' })}${field(t('Comissão — plano Premium (700 = 7%)'), 'premium_commission_bps', { type: 'number', value: s.premium_commission_bps, attrs: 'min="0" max="5000"' })}${field(t('Taxa de serviço ao cliente (0 = sem taxa)'), 'customer_fee_bps', { type: 'number', value: s.customer_fee_bps, attrs: 'min="0" max="5000"' })}
  <p>${t('Modo de pagamentos')}: <strong>${s.payment_mode}</strong> <span class="meta">(${t('definido por variável de ambiente')})</span></p>${errBox()}<button class="btn" type="submit">${t('Salvar')}</button></form>`);
}, R);
form('settings', async (d) => { await api('/admin/settings', { method: 'PUT', body: { commission_bps: Number(d.commission_bps), premium_commission_bps: Number(d.premium_commission_bps), customer_fee_bps: Number(d.customer_fee_bps) } }); toast(t('Configurações salvas e registradas na auditoria.')); });

route('/admin/auditoria', async (ctx) => {
  const a = await api('/admin/audit'); ctx.title = t('Auditoria');
  return page('/admin/auditoria', t('Registro de alterações'), table([t('Quando'), t('Quem'), t('Ação'), t('Entidade'), t('Detalhes')], a.map((x) => [fmtDateTime(x.created_at), x.actor || t('sistema'), x.action, x.entity ? `${x.entity} #${x.entity_id ?? ''}` : '—', html`<code>${x.detail || ''}</code>`])));
}, R);

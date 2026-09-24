// Núcleo do frontend: templates com escape automático, API, roteador, ações e componentes.
export class Raw { constructor(s) { this.s = s; } toString() { return this.s; } }
export const raw = (s) => new Raw(s);
export const esc = (v) => String(v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const val = (v) => (v == null || v === false ? '' : v instanceof Raw ? v.s : Array.isArray(v) ? v.map(val).join('') : esc(v));
export const html = (s, ...v) => new Raw(s.reduce((a, str, i) => a + str + (i < v.length ? val(v[i]) : ''), ''));

export const state = { user: null, config: null, cart: null };
const store = {
  get(k) { try { return JSON.parse(localStorage.getItem('agitae.' + k)); } catch { return null; } },
  set(k, v) { try { localStorage.setItem('agitae.' + k, JSON.stringify(v)); } catch {} },
  del(k) { try { localStorage.removeItem('agitae.' + k); } catch {} },
};
export { store };

// ---------- formatação ----------
export const money = (c) => (c / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
export const fmtDate = (d) => (d ? d.slice(0, 10).split('-').reverse().join('/') : '');
export const fmtDateTime = (d) => (d ? fmtDate(d) + ' ' + d.slice(11, 16) : '');
export function toCents(v) {
  if (v === '' || v == null) return null;
  const n = Number(String(v).replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(n) ? Math.round(n * 100) : NaN;
}
export const centsToInput = (c) => (c == null ? '' : (c / 100).toFixed(2).replace('.', ','));
export const STATUS = { solicitado: ['Solicitado', 'info'], aguardando_resposta: ['Aguardando resposta', 'warn'], proposta_enviada: ['Proposta enviada', 'info'], aguardando_pagamento: ['Aguardando pagamento', 'orange'], confirmado: ['Confirmado', 'ok'], em_preparacao: ['Em preparação', 'ok'], concluido: ['Concluído', 'ok'], cancelado: ['Cancelado', 'bad'], em_disputa: ['Em disputa', 'bad'] };
export const statusTag = (s) => html`<span class="tag ${(STATUS[s] || [s, 'info'])[1]}">${(STATUS[s] || [s])[0]}</span>`;
export const EVENT_TYPE = { aniversario: 'Aniversário', casamento: 'Casamento', infantil: 'Festa infantil', formatura: 'Formatura', confraternizacao: 'Confraternização', cha: 'Chá', corporativo: 'Evento corporativo', outro: 'Outro' };
export function priceLabel(s) {
  if (s.price_type === 'orcamento') return html`<span class="price">Sob orçamento</span>`;
  const u = s.unit ? html` <small>/ ${s.unit}</small>` : '';
  return s.price_type === 'a_partir_de' ? html`<span class="price"><small>a partir de</small> ${money(s.price_cents)}${u}</span>` : html`<span class="price">${money(s.price_cents)}${u}</span>`;
}
export const priceKind = (t) => ({ fechado: ['Preço fechado', 'ok'], a_partir_de: ['A partir de', 'info'], orcamento: ['Sob orçamento', 'orange'] }[t]);

// ---------- API ----------
export async function api(path, { method = 'GET', body, raw: rawBody, headers = {} } = {}) {
  const res = await fetch('/api' + path, { method, credentials: 'same-origin', headers: { 'X-Requested-With': 'agitae', ...(body ? { 'Content-Type': 'application/json' } : {}), ...headers }, body: rawBody ?? (body ? JSON.stringify(body) : undefined) });
  let data = null; try { data = await res.json(); } catch {}
  if (!res.ok) { const e = new Error(data?.error || 'Algo deu errado. Tente novamente.'); e.status = res.status; throw e; }
  return data;
}

// ---------- feedback ----------
let toastTimer;
export function toast(msg, err = false) {
  const t = document.getElementById('toast'); t.textContent = msg; t.className = 'toast show' + (err ? ' err' : '');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => (t.className = 'toast'), 3800);
}
export const dlg = () => document.getElementById('dialog');
export function openDialog(title, body) {
  const d = dlg();
  d.innerHTML = html`<div class="dhead"><h2 style="margin:0">${title}</h2><button class="btn ghost sm" data-act="close-dialog" aria-label="Fechar">✕</button></div><div class="dbody">${body}</div>`.s;
  if (!d.open) d.showModal();
}
export const closeDialog = () => { const d = dlg(); if (d.open) d.close(); };
export const errBox = () => html`<div class="form-error" role="alert" data-error hidden></div>`;
export function showError(scope, msg) {
  const e = scope.querySelector('[data-error]'); if (!e) return toast(msg, true);
  e.textContent = msg; e.hidden = false; e.scrollIntoView({ block: 'nearest' });
}

// ---------- componentes ----------
export function field(label, name, o = {}) {
  const id = 'f-' + name, req = o.required ? { required: true } : {};
  const common = html`id="${id}" name="${name}" ${o.required ? raw('required') : ''} ${o.hint ? raw(`aria-describedby="h-${esc(name)}"`) : ''} ${o.placeholder ? raw(`placeholder="${esc(o.placeholder)}"`) : ''} ${o.attrs ? raw(o.attrs) : ''}`;
  let control;
  if (o.type === 'textarea') control = html`<textarea ${common} rows="${o.rows || 3}">${o.value ?? ''}</textarea>`;
  else if (o.type === 'select') control = html`<select ${common}>${(o.options || []).map(([v, l]) => html`<option value="${v}" ${String(v) === String(o.value ?? '') ? raw('selected') : ''}>${l}</option>`)}</select>`;
  else if (o.type === 'checkbox') return html`<label class="check"><input type="checkbox" ${common} ${o.value ? raw('checked') : ''}> <span>${o.label2 || label}</span></label>`;
  else control = html`<input ${common} type="${o.type || 'text'}" value="${o.value ?? ''}" ${o.min ? raw(`min="${esc(o.min)}"`) : ''} ${o.max ? raw(`max="${esc(o.max)}"`) : ''} ${o.autocomplete ? raw(`autocomplete="${esc(o.autocomplete)}"`) : ''}>`;
  return html`<div class="field ${o.cls || ''}"><label for="${id}">${label}${o.required ? raw('<span aria-hidden="true"> *</span>') : ''}</label>${control}${o.hint ? html`<small id="h-${name}">${o.hint}</small>` : ''}</div>`;
}
export const empty = (icon, title, text, action) => html`<div class="empty"><div class="i" aria-hidden="true">${icon}</div><h3>${title}</h3><p class="meta">${text}</p>${action || ''}</div>`;
export const skeleton = (n = 3) => html`<div class="wrap page"><div class="grid g2">${Array.from({ length: n }, () => html`<div class="skeleton" aria-hidden="true"></div>`)}</div><p class="meta" role="status">Carregando…</p></div>`;
export const table = (heads, rows) => html`<div class="tablewrap"><table><thead><tr>${heads.map((h) => html`<th scope="col">${h}</th>`)}</tr></thead><tbody>${rows.map((r) => html`<tr>${r.map((c) => html`<td>${c}</td>`)}</tr>`)}</tbody></table></div>`;
export const stars = (r, n) => (r == null ? html`<span class="meta">Novo na Agitaê</span>` : html`<span class="stars" aria-label="Nota ${r} de 5, ${n} avaliações">★ ${r.toFixed(1).replace('.', ',')} <span class="meta">(${n})</span></span>`);
export const back = (href, text) => html`<p><a href="${href}">← ${text}</a></p>`;

// ---------- ações / formulários ----------
export const actions = {}, forms = {};
export const act = (name, fn) => (actions[name] = fn);
export const form = (name, fn) => (forms[name] = fn);
act('close-dialog', () => closeDialog());
document.addEventListener('click', async (e) => {
  const el = e.target.closest('[data-act]'); if (!el || !actions[el.dataset.act]) return;
  if (el.tagName === 'A' && !el.getAttribute('href')) e.preventDefault();
  if (el.dataset.confirm && !confirm(el.dataset.confirm)) return;
  try { el.setAttribute('aria-busy', 'true'); await actions[el.dataset.act](el, e); } catch (err) { handleError(err); } finally { el.removeAttribute('aria-busy'); }
});
document.addEventListener('submit', async (e) => {
  const f = e.target.closest('[data-form]'); if (!f || !forms[f.dataset.form]) return;
  e.preventDefault();
  const err = f.querySelector('[data-error]'); if (err) err.hidden = true;
  const btn = f.querySelector('button[type=submit]'); if (btn) btn.disabled = true;
  try { await forms[f.dataset.form](Object.fromEntries(new FormData(f)), f); } catch (ex) { if (ex.status === 401) return needLogin(); showError(f, ex.message); } finally { if (btn) btn.disabled = false; }
});
function handleError(err) { if (err.status === 401) return needLogin(); toast(err.message, true); }
export function needLogin() { closeDialog(); toast('Entre na sua conta para continuar.', true); location.hash = '#/entrar?next=' + encodeURIComponent(location.hash.slice(1)); }
export const go = (h) => { location.hash = h; };

// ---------- roteador ----------
const routes = [];
export const route = (pattern, handler, opts = {}) => { const keys = []; const re = new RegExp('^' + pattern.replace(/:([a-z]+)/g, (_, k) => { keys.push(k); return '([^/]+)'; }) + '/?$'); routes.push({ re, keys, handler, opts }); };
export async function render() {
  const [path, qs] = (location.hash.slice(1) || '/').split('?');
  const main = document.getElementById('main');
  const r = routes.find((x) => x.re.test(path));
  closeDialog();
  if (!r) { main.innerHTML = empty('🤔', 'Página não encontrada', 'O endereço que você abriu não existe.', html`<a class="btn" href="#/">Voltar ao início</a>`).s; return; }
  const m = r.re.exec(path);
  const ctx = { params: Object.fromEntries(r.keys.map((k, i) => [k, decodeURIComponent(m[i + 1])])), query: Object.fromEntries(new URLSearchParams(qs || '')), path, title: '' };
  if (r.opts.auth && !state.user) return needLogin();
  if (r.opts.role && !(state.user?.roles || []).includes(r.opts.role)) { main.innerHTML = empty('🔒', 'Acesso restrito', 'Você não tem permissão para ver esta área.', html`<a class="btn" href="#/">Voltar ao início</a>`).s; return; }
  const my = (renderToken = {});
  main.innerHTML = skeleton().s;
  try {
    const out = await r.handler(ctx);
    if (my !== renderToken) return;
    main.innerHTML = (out instanceof Raw ? out.s : String(out));
    document.title = (ctx.title ? ctx.title + ' · ' : '') + 'Agitaê';
    if (ctx.mount) await ctx.mount(main);
    if (!ctx.keepScroll) window.scrollTo(0, 0);
    (main.querySelector('h1') || main).setAttribute('tabindex', '-1'); (main.querySelector('h1') || main).focus({ preventScroll: true });
  } catch (e) {
    if (my !== renderToken) return;
    if (e.status === 401) return needLogin();
    main.innerHTML = html`<div class="wrap page">${empty('⚠️', e.status === 404 ? 'Não encontramos isso' : 'Não foi possível carregar', e.message, html`<button class="btn" data-act="reload">Tentar novamente</button>`)}</div>`.s;
  }
  markNav();
}
let renderToken = {};
act('reload', () => render());
export function markNav() {
  const cur = location.hash.slice(1).split('?')[0] || '/';
  document.querySelectorAll('.nav a, .tabbar a').forEach((a) => { const h = a.getAttribute('href').slice(1); (h === '/' ? cur === '/' : cur.startsWith(h)) ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current'); });
}

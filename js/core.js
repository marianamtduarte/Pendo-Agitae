// Núcleo do frontend: templates com escape automático, API, roteador, ações e componentes.
import { t, lang } from './i18n.js';
export { t };

export class Raw { constructor(s) { this.s = s; } toString() { return this.s; } }
export const raw = (s) => new Raw(s);
export const esc = (v) => String(v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const val = (v) => (v == null || v === false ? '' : v instanceof Raw ? v.s : Array.isArray(v) ? v.map(val).join('') : esc(v));
export const html = (s, ...v) => new Raw(s.reduce((a, str, i) => a + str + (i < v.length ? val(v[i]) : ''), ''));

export const state = { user: null, config: null, cart: null };
export const store = {
  get(k) { try { return JSON.parse(localStorage.getItem('agitae.' + k)); } catch { return null; } },
  set(k, v) { try { localStorage.setItem('agitae.' + k, JSON.stringify(v)); } catch {} },
  del(k) { try { localStorage.removeItem('agitae.' + k); } catch {} },
};

// ---------- analytics (Pendo entra aqui depois; sem o snippet, é um no-op seguro) ----------
export function track(name, props = {}) {
  try { if (window.pendo && typeof window.pendo.track === 'function') window.pendo.track(name, props); } catch {}
  try { window.dispatchEvent(new CustomEvent('agitae:track', { detail: { name, props } })); } catch {}
}

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
const STATUS_TONE = { solicitado: 'info', aguardando_resposta: 'warn', proposta_enviada: 'info', aguardando_pagamento: 'orange', confirmado: 'ok', em_preparacao: 'ok', concluido: 'ok', cancelado: 'bad', em_disputa: 'bad' };
export const STATUS_LABEL = () => ({ solicitado: t('Solicitado'), aguardando_resposta: t('Aguardando resposta'), proposta_enviada: t('Proposta enviada'), aguardando_pagamento: t('Aguardando pagamento'), confirmado: t('Confirmado'), em_preparacao: t('Em preparação'), concluido: t('Concluído'), cancelado: t('Cancelado'), em_disputa: t('Em disputa') });
export const statusTag = (s) => html`<span class="tag ${STATUS_TONE[s] || 'info'}">${STATUS_LABEL()[s] || s}</span>`;
export const EVENT_TYPE = () => ({ aniversario: t('Aniversário'), casamento: t('Casamento'), infantil: t('Festa infantil'), formatura: t('Formatura'), confraternizacao: t('Confraternização'), cha: t('Chá'), corporativo: t('Evento corporativo'), outro: t('Outro') });
export function priceLabel(s) {
  if (s.price_type === 'orcamento') return html`<span class="price">${t('Sob orçamento')}</span>`;
  const u = s.unit ? html` <small>/ ${s.unit}</small>` : '';
  return s.price_type === 'a_partir_de' ? html`<span class="price"><small>${t('a partir de')}</small> ${money(s.price_cents)}${u}</span>` : html`<span class="price">${money(s.price_cents)}${u}</span>`;
}
export const priceKind = (k) => ({ fechado: [t('Preço fechado'), 'ok'], a_partir_de: [t('A partir de'), 'info'], orcamento: [t('Sob orçamento'), 'orange'] }[k]);

// ---------- ícones (SVG inline) ----------
const P = { search: 'M11 4a7 7 0 1 0 4.2 12.6l4.6 4.6 1.4-1.4-4.6-4.6A7 7 0 0 0 11 4Zm0 2a5 5 0 1 1 0 10 5 5 0 0 1 0-10Z', pin: 'M12 2a7 7 0 0 0-7 7c0 5 7 13 7 13s7-8 7-13a7 7 0 0 0-7-7Zm0 9.5A2.5 2.5 0 1 1 12 6a2.5 2.5 0 0 1 0 5.5Z', heart: 'M12 21s-7.5-4.7-9.6-9.2C.9 8.5 2.6 5 6 5c2 0 3.3 1 4 2.2h4C14.700 6 16 5 18 5c3.400 0 5.100 3.500 3.600 6.800C19.500 16.300 12 21 12 21Z', bell: 'M12 22a2.500 2.500 0 0 0 2.400-2h-4.800A2.500 2.500 0 0 0 12 22Zm7-6V11a7 7 0 0 0-5-6.700V3.500a2 2 0 0 0-4 0v.8A7 7 0 0 0 5 11v5l-2 2v1h18v-1l-2-2Z', user: 'M12 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10Zm0 2c-4.400 0-8 2.200-8 5v2h16v-2c0-2.800-3.600-5-8-5Z', globe: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm6.900 9h-3a15 15 0 0 0-1.200-5.200A8 8 0 0 1 18.900 11ZM12 4c.900 1 1.900 3.100 2.200 7H9.800C10.100 7.100 11.100 5 12 4ZM9.300 5.800A15 15 0 0 0 8.100 11h-3a8 8 0 0 1 4.200-5.200ZM5.100 13h3a15 15 0 0 0 1.200 5.200A8 8 0 0 1 5.100 13Zm6.900 7c-.900-1-1.900-3.100-2.200-7h4.400c-.300 3.900-1.300 6-2.200 7Zm2.700-1.800A15 15 0 0 0 15.900 13h3a8 8 0 0 1-4.200 5.200Z', check: 'm9 16.200-3.500-3.500L4 14.200l5 5 11-11-1.500-1.500L9 16.200Z', star: 'm12 17.300-6.200 3.700 1.600-7L2 9.200l7.200-.6L12 2l2.800 6.600 7.200.6-5.400 4.800 1.600 7L12 17.300Z', plus: 'M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2Z', cal: 'M7 2v2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-2V2h-2v2H9V2H7Zm-2 8h14v10H5V10Z', bag: 'M6 7V6a6 6 0 0 1 12 0v1h3l-1 15H4L3 7h3Zm2 0h8V6a4 4 0 0 0-8 0v1Z', menu: 'M3 6h18v2H3V6Zm0 5h18v2H3v-2Zm0 5h18v2H3v-2Z', share: 'M18 16a3 3 0 0 0-2.400 1.200L8.900 13.600a3 3 0 0 0 0-3.200l6.700-3.600A3 3 0 1 0 15 5a3 3 0 0 0 .1.800L8.500 9.400a3 3 0 1 0 0 5.200l6.700 3.600A3 3 0 1 0 18 16Z', chat: 'M4 3h16a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H8l-5 4V5a2 2 0 0 1 1-2Z', clock: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm1 5h-2v6l5 3 1-1.700-4-2.300V7Z', shield: 'M12 2 4 5v6c0 5 3.400 9.700 8 11 4.600-1.300 8-6 8-11V5l-8-3Zm-1 14-4-4 1.400-1.400L11 13.200l5.600-5.600L18 9l-7 7Z', arrow: 'M4 11h12.200l-5.600-5.600L12 4l8 8-8 8-1.400-1.400 5.600-5.600H4v-2Z' };
export const icon = (n, size = 20) => html`<svg class="ic" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="currentColor"><path d="${P[n] || P.star}"/></svg>`;

// ---------- API ----------
export async function api(path, { method = 'GET', body, raw: rawBody, headers = {} } = {}) {
  let data = null, ok = true, status = 200;
  if (window.AGITAE_DEMO) { // versão de demonstração estática: o "servidor" roda no navegador
    const r = await window.AGITAE_DEMO({ method, path, body: rawBody instanceof Blob ? null : body, lang, isUpload: rawBody instanceof Blob });
    data = r.data; status = r.status; ok = r.status < 400;
  } else {
    const res = await fetch('/api' + path, { method, credentials: 'same-origin', headers: { 'X-Requested-With': 'agitae', 'X-Lang': lang, ...(body ? { 'Content-Type': 'application/json' } : {}), ...headers }, body: rawBody ?? (body ? JSON.stringify(body) : undefined) });
    try { data = await res.json(); } catch {}
    ok = res.ok; status = res.status;
  }
  if (!ok) { const e = new Error(data?.error || t('Algo deu errado. Tente novamente.')); e.status = status; throw e; }
  return data;
}

// ---------- feedback ----------
let toastTimer;
export function toast(msg, err = false) {
  const el = document.getElementById('toast'); el.textContent = msg; el.className = 'toast show' + (err ? ' err' : '');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => (el.className = 'toast'), 4000);
}
export const dlg = () => document.getElementById('dialog');
export function openDialog(title, body, cls = '') {
  const d = dlg();
  d.className = 'dialog ' + cls;
  d.innerHTML = html`<div class="dhead"><h2>${title}</h2><button class="iconbtn" data-act="close-dialog" aria-label="${t('Fechar')}">✕</button></div><div class="dbody">${body}</div>`.s;
  if (!d.open) d.showModal();
}
export const closeDialog = () => { const d = dlg(); if (d.open) d.close(); };
document.addEventListener('click', (e) => { const d = dlg(); if (d.open && e.target === d) d.close(); });
export const errBox = () => html`<div class="form-error" role="alert" data-error hidden></div>`;
export function showError(scope, msg) {
  const e = scope.querySelector('[data-error]'); if (!e) return toast(msg, true);
  e.textContent = msg; e.hidden = false; e.scrollIntoView({ block: 'nearest' });
}

// ---------- componentes ----------
export function field(label, name, o = {}) {
  const id = 'f-' + name;
  const common = html`id="${id}" name="${name}" ${o.required ? raw('required') : ''} ${o.hint ? raw(`aria-describedby="h-${esc(name)}"`) : ''} ${o.placeholder ? raw(`placeholder="${esc(o.placeholder)}"`) : ''} ${o.attrs ? raw(o.attrs) : ''}`;
  let control;
  if (o.type === 'textarea') control = html`<textarea ${common} rows="${o.rows || 3}">${o.value ?? ''}</textarea>`;
  else if (o.type === 'select') control = html`<select ${common}>${(o.options || []).map(([v, l]) => html`<option value="${v}" ${String(v) === String(o.value ?? '') ? raw('selected') : ''}>${l}</option>`)}</select>`;
  else if (o.type === 'checkbox') return html`<label class="check"><input type="checkbox" ${common} ${o.value ? raw('checked') : ''}> <span>${o.label2 || label}</span></label>`;
  else control = html`<input ${common} type="${o.type || 'text'}" value="${o.value ?? ''}" ${o.min ? raw(`min="${esc(o.min)}"`) : ''} ${o.max ? raw(`max="${esc(o.max)}"`) : ''} ${o.autocomplete ? raw(`autocomplete="${esc(o.autocomplete)}"`) : ''}>`;
  return html`<div class="field ${o.cls || ''}"><label for="${id}">${label}${o.required ? raw('<span aria-hidden="true"> *</span>') : ''}</label>${control}${o.hint ? html`<small id="h-${name}">${o.hint}</small>` : ''}</div>`;
}
export const empty = (ic, title, text, action) => html`<div class="empty"><div class="i" aria-hidden="true">${ic}</div><h3>${title}</h3><p class="meta">${text}</p>${action || ''}</div>`;
export const skeleton = (n = 3) => html`<div class="wrap page"><div class="grid g3">${Array.from({ length: n }, () => html`<div class="skeleton" aria-hidden="true"></div>`)}</div><p class="meta" role="status">${t('Carregando…')}</p></div>`;
export const table = (heads, rows) => html`<div class="tablewrap"><table><thead><tr>${heads.map((h) => html`<th scope="col">${h}</th>`)}</tr></thead><tbody>${rows.map((r) => html`<tr>${r.map((c) => html`<td>${c}</td>`)}</tr>`)}</tbody></table></div>`;
export const stars = (r, n) => (r == null ? html`<span class="meta">${t('Novo na Agitaê')}</span>` : html`<span class="rating" aria-label="${t('Nota {r} de 5, {n} avaliações', { r, n })}">${icon('star', 14)} ${r.toFixed(1).replace('.', ',')} <span class="meta">(${n})</span></span>`);
export const back = (href, text) => html`<p class="crumb"><a href="${href}">← ${text}</a></p>`;

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
export function needLogin() { closeDialog(); toast(t('Entre na sua conta para continuar.'), true); location.hash = '#/entrar?next=' + encodeURIComponent(location.hash.slice(1)); }
export const go = (h) => { location.hash = h; };
export const reload = () => render();

// ---------- roteador ----------
const routes = [];
let renderToken = {};
export const route = (pattern, handler, opts = {}) => { const keys = []; const re = new RegExp('^' + pattern.replace(/:([a-z]+)/g, (_, k) => { keys.push(k); return '([^/]+)'; }) + '/?$'); routes.push({ re, keys, handler, opts }); };
export async function render() {
  const [path, qs] = (location.hash.slice(1) || '/').split('?');
  const main = document.getElementById('main');
  const r = routes.find((x) => x.re.test(path));
  closeDialog();
  if (!r) { main.innerHTML = html`<div class="wrap page">${empty('🤔', t('Página não encontrada'), t('O endereço que você abriu não existe.'), html`<a class="btn" href="#/">${t('Voltar ao início')}</a>`)}</div>`.s; return; }
  const m = r.re.exec(path);
  const ctx = { params: Object.fromEntries(r.keys.map((k, i) => [k, decodeURIComponent(m[i + 1])])), query: Object.fromEntries(new URLSearchParams(qs || '')), path, title: '', bare: false };
  if (r.opts.auth && !state.user) return needLogin();
  if (r.opts.role && !(state.user?.roles || []).includes(r.opts.role)) { main.innerHTML = html`<div class="wrap page">${empty('🔒', t('Acesso restrito'), t('Você não tem permissão para ver esta área.'), html`<a class="btn" href="#/">${t('Voltar ao início')}</a>`)}</div>`.s; return; }
  const my = (renderToken = {});
  main.innerHTML = skeleton().s;
  try {
    const out = await r.handler(ctx);
    if (my !== renderToken) return;
    main.innerHTML = out instanceof Raw ? out.s : String(out);
    document.title = (ctx.title ? ctx.title + ' · ' : '') + 'Agitaê';
    document.body.classList.toggle('bare', !!ctx.bare);
    if (ctx.mount) await ctx.mount(main);
    if (!ctx.keepScroll) window.scrollTo(0, 0);
    const h1 = main.querySelector('h1') || main; h1.setAttribute('tabindex', '-1'); h1.focus({ preventScroll: true });
    track('page_view', { path });
  } catch (e) {
    if (my !== renderToken) return;
    if (e.status === 401) return needLogin();
    main.innerHTML = html`<div class="wrap page">${empty('⚠️', e.status === 404 ? t('Não encontramos isso') : t('Não foi possível carregar'), e.message, html`<button class="btn" data-act="reload">${t('Tentar novamente')}</button>`)}</div>`.s;
  }
  markNav();
}
act('reload', () => render());
export function markNav() {
  const cur = location.hash.slice(1).split('?')[0] || '/';
  document.querySelectorAll('[data-nav]').forEach((a) => { const h = a.getAttribute('href').slice(1); (h === '/' ? cur === '/' : cur.startsWith(h)) ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current'); });
}

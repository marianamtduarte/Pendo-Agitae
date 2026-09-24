import { api, state, html, raw, render, markNav, act, store, toast, go, actions } from './core.js';
import './pages-public.js';
import './pages-client.js';
import './pages-provider.js';
import './pages-admin.js';

export function renderChrome() {
  const u = state.user, roles = u?.roles || [];
  document.getElementById('header').innerHTML = html`${state.config?.payment_mode === 'test' ? html`<div class="demo">Ambiente de demonstração · dados e pagamentos fictícios</div>` : ''}
  <div class="wrap">
    <a class="logo" href="#/" aria-label="Agitaê — página inicial"><svg width="34" height="34" viewBox="0 0 64 64" aria-hidden="true"><rect width="64" height="64" rx="16" fill="#2956D9"/><path d="M20 44c0-9 6-16 14-16 6 0 10 4 10 10 0 5-4 8-8 8-5 0-8-3-8-8" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round"/><circle cx="46" cy="18" r="6" fill="#FF7C00"/></svg>agitaê</a>
    <nav class="nav" aria-label="Principal">
      <a href="#/busca">Explorar</a><a href="#/eventos">Meus eventos</a><a href="#/pedidos">Pedidos</a><a href="#/orcamentos">Orçamentos</a>
      ${roles.includes('fornecedor') ? html`<a href="#/fornecedor">Painel do fornecedor</a>` : html`<a href="#/fornecedor/cadastro">Sou fornecedor</a>`}
      ${roles.includes('admin') ? html`<a href="#/admin">Admin</a>` : ''}
    </nav>
    <div class="nav-right">${u ? html`<a class="btn ghost sm" href="#/notificacoes" aria-label="Notificações${u.unread ? `: ${u.unread} novas` : ''}">🔔${u.unread ? html`<span class="badge-count">${u.unread}</span>` : ''}</a><a class="btn ghost sm" href="#/conta">${u.name.split(' ')[0]}</a><button class="btn ghost sm" data-act="logout">Sair</button>` : html`<a class="btn ghost sm" href="#/entrar">Entrar</a><a class="btn sm" href="#/cadastro">Criar conta</a>`}</div>
  </div>`.s;
  document.getElementById('tabbar').innerHTML = html`<a href="#/"><span aria-hidden="true">🏠</span>Início</a><a href="#/busca"><span aria-hidden="true">🔎</span>Explorar</a><a href="#/eventos"><span aria-hidden="true">🎉</span>Eventos</a><a href="#/pedidos"><span aria-hidden="true">🧾</span>Pedidos</a><a href="${u ? '#/conta' : '#/entrar'}"><span aria-hidden="true">👤</span>${u ? 'Conta' : 'Entrar'}</a>`.s;
  document.getElementById('footer').innerHTML = html`<div class="wrap"><div><strong>agitaê</strong><br>Organize sua festa de forma rápida e fácil.</div><div><a href="#/privacidade">Política de Privacidade</a><br><a href="#/fornecedor/cadastro">Seja um fornecedor</a></div><div class="meta" style="color:#B9C3E6">Imagens e dados de demonstração são fictícios.</div></div>`.s;
  markNav();
}
export async function refreshUser() {
  try { state.user = (await api('/me')).user; } catch { state.user = null; }
  renderChrome();
}
act('logout', async () => { await api('/auth/logout', { method: 'POST' }); state.user = null; renderChrome(); toast('Você saiu da sua conta.'); go('#/'); });
window.addEventListener('agitae:user', refreshUser);
window.addEventListener('hashchange', () => { render(); });
await Promise.all([api('/config').then((c) => (state.config = c)).catch(() => { state.config = { categories: [], cities: [], event_types: [] }; }), refreshUser()]);
renderChrome();
render();

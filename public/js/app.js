import { api, state, html, raw, render, markNav, act, form, toast, go, t, icon, track } from './core.js';
import { lang, setLang } from './i18n.js';
import { locLabel } from './loc.js';
import './pages-public.js';
import './pages-client.js';
import './pages-provider.js';
import './pages-admin.js';

export function renderChrome() {
  const u = state.user, roles = u?.roles || [];
  const lbl = locLabel();
  document.getElementById('header').innerHTML = html`${window.AGITAE_DEMO ? html`<div class="demo">${t('Demonstração online: os dados ficam apenas neste navegador · pagamentos fictícios')}</div>` : state.config?.payment_mode === 'test' ? html`<div class="demo">${t('Ambiente de demonstração · dados e pagamentos fictícios')}</div>` : ''}
  <div class="wrap">
    <a class="logo" href="#/" aria-label="${t('Agitaê — página inicial')}"><svg width="36" height="36" viewBox="0 0 64 64" aria-hidden="true"><rect width="64" height="64" rx="16" fill="#2956D9"/><path d="M20 44c0-9 6-16 14-16 6 0 10 4 10 10 0 5-4 8-8 8-5 0-8-3-8-8" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round"/><circle cx="46" cy="18" r="6" fill="#FF7C00"/></svg>agitaê</a>
    <button class="locpill" data-act="loc-open" aria-label="${t('Alterar local do evento')}">${icon('pin', 18)}<span>${lbl || t('Definir local')}</span></button>
    <form class="hsearch" data-form="hsearch" role="search">${icon('search', 20)}<input name="q" type="search" placeholder="${t('Buscar bolo, fotógrafo, buffet, DJ…')}" aria-label="${t('Buscar serviços')}"></form>
    <div class="hlinks">
      <a class="hlink" data-nav href="#/busca">${t('Explorar')}</a>
      ${roles.includes('fornecedor') ? html`<a class="hlink" data-nav href="#/fornecedor">${t('Painel do fornecedor')}</a>` : html`<a class="hlink" data-nav href="#/fornecedor/cadastro">${t('Sou fornecedor')}</a>`}
      <div class="lang" role="group" aria-label="${t('Idioma')}"><button data-act="set-lang" data-lang="pt" aria-pressed="${lang === 'pt'}" lang="pt">PT</button><button data-act="set-lang" data-lang="en" aria-pressed="${lang === 'en'}" lang="en">EN</button></div>
      ${u ? html`<a class="iconbtn" href="#/notificacoes" aria-label="${t('Notificações')}${u.unread ? ': ' + u.unread : ''}">${icon('bell', 20)}${u.unread ? html`<span class="dot">${u.unread}</span>` : ''}</a>
        <details class="menu"><summary class="avatar" aria-label="${t('Menu da conta')}">${u.name.slice(0, 1).toUpperCase()}</summary><div class="menupanel">
          <div class="who">${u.name}<br>${u.email}</div><a href="#/eventos">${t('Meus eventos')}</a><a href="#/pedidos">${t('Pedidos')}</a><a href="#/orcamentos">${t('Orçamentos')}</a><a href="#/conta">${t('Minha conta')}</a><hr>
          ${roles.includes('fornecedor') ? html`<a href="#/fornecedor">${t('Painel do fornecedor')}</a>` : html`<a href="#/fornecedor/cadastro">${t('Cadastrar meu negócio')}</a>`}
          ${roles.includes('admin') ? html`<a href="#/admin">${t('Administração')}</a>` : ''}<hr><button data-act="logout">${t('Sair')}</button></div></details>`
      : html`<a class="btn ghost sm" href="#/entrar">${t('Entrar')}</a><a class="btn sm" href="#/cadastro">${t('Criar conta')}</a>`}
    </div>
  </div>`.s;
  document.getElementById('tabbar').innerHTML = html`<a data-nav href="#/">${icon('bag', 22)}${t('Início')}</a><a data-nav href="#/busca">${icon('search', 22)}${t('Explorar')}</a><a data-nav href="#/eventos">${icon('cal', 22)}${t('Eventos')}</a><a data-nav href="#/pedidos">${icon('check', 22)}${t('Pedidos')}</a><a data-nav href="${u ? '#/conta' : '#/entrar'}">${icon('user', 22)}${u ? t('Conta') : t('Entrar')}</a>`.s;
  document.getElementById('footer').innerHTML = html`<div class="wrap"><div class="cols4">
    <div><strong style="color:#fff;font-size:1.3rem">agitaê</strong><p>${t('Organize sua festa de forma rápida e fácil.')}</p></div>
    <div><h4>${t('Explorar')}</h4><ul><li><a href="#/categoria/doces-salgados">${t('Doces e salgados')}</a></li><li><a href="#/categoria/fotografia">${t('Fotografia')}</a></li><li><a href="#/categoria/buffet">${t('Buffet')}</a></li><li><a href="#/busca">${t('Todas as categorias')}</a></li></ul></div>
    <div><h4>${t('Para fornecedores')}</h4><ul><li><a href="#/fornecedor/cadastro">${t('Cadastre seu negócio')}</a></li><li><a href="#/fornecedor">${t('Painel do fornecedor')}</a></li></ul></div>
    <div><h4>${t('Agitaê')}</h4><ul><li><a href="#/privacidade">${t('Política de Privacidade')}</a></li><li><a href="#/eventos">${t('Planejar minha festa')}</a></li></ul></div></div>
    <div class="legal"><span>© ${new Date().getFullYear()} Agitaê</span><span>${t('Imagens e dados de demonstração são fictícios.')} ${window.AGITAE_DEMO ? html`<button class="btn ghost sm" style="margin-left:8px" data-act="demo-reset" data-confirm="${t('Apagar as alterações feitas nesta demonstração e voltar aos dados iniciais?')}">${t('Restaurar demonstração')}</button>` : ''}</span></div></div>`.s;
  markNav();
}
export async function refreshUser() { try { state.user = (await api('/me')).user; } catch { state.user = null; } renderChrome(); }
act('demo-reset', () => window.AGITAE_DEMO_RESET && window.AGITAE_DEMO_RESET());
act('logout', async () => { await api('/auth/logout', { method: 'POST' }); state.user = null; renderChrome(); toast(t('Você saiu da sua conta.')); go('#/'); });
act('set-lang', async (el) => { setLang(el.dataset.lang); track('language_changed', { lang: el.dataset.lang }); state.config = await api('/config').catch(() => state.config); renderChrome(); render(); });
form('hsearch', (d) => go('#/busca?q=' + encodeURIComponent(d.q || '')));
// Ajuda para o Pendo (sem dados pessoais): window.agitaeVisitor() → { id, role }
window.agitaeVisitor = () => ({ id: state.user ? 'u' + state.user.id : 'anonymous', role: (state.user?.roles || ['visitante']).join(',') });
window.addEventListener('agitae:user', refreshUser);
window.addEventListener('agitae:chrome', renderChrome);
window.addEventListener('hashchange', () => { render(); });
document.addEventListener('click', (e) => { document.querySelectorAll('details.menu[open]').forEach((d) => { if (!d.contains(e.target)) d.open = false; }); if (e.target.closest('.menupanel a, .menupanel button')) document.querySelectorAll('details.menu[open]').forEach((d) => (d.open = false)); });
await Promise.all([api('/config').then((c) => (state.config = c)).catch(() => { state.config = { categories: [], cities: [], event_types: [] }; }), refreshUser()]);
renderChrome();
render();

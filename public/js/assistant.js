// Widget do assistente de festas: botão flutuante + painel de chat, disponível em qualquer tela do site
// (não é uma rota). Sem servidor configurado (ex.: demo estática), o próprio servidor recusa com uma
// mensagem clara — o widget só exibe essa mensagem, nunca inventa uma resposta.
import { api, html, act, form, t, icon, track, money } from './core.js';

let open = false, sending = false, convId = null, messages = [], root;

function bubble(m) {
  return html`<div class="msg ${m.role === 'user' ? 'mine' : ''}">${m.text}</div>
    ${m.providers && m.providers.length ? html`<div class="assist-cards">${m.providers.map((p) => html`<a class="assist-card" href="#/f/${p.slug}" data-act="assist-close"><img src="${p.cover_url}" alt="" loading="lazy"><div><strong>${p.name}</strong><br><span class="meta">${p.city}/${p.state}</span>${p.from_price_cents != null ? html` · <span class="price">${money(p.from_price_cents)}</span>` : ''}</div></a>`)}</div>` : ''}`;
}
function render() {
  if (!root) return;
  root.innerHTML = html`<button class="assist-fab" data-act="assist-toggle" aria-expanded="${open}" aria-label="${open ? t('Fechar assistente') : t('Abrir assistente de festas')}">${open ? '✕' : icon('chat', 24)}</button>
    ${open ? html`<div class="assist-panel" role="dialog" aria-label="${t('Assistente da Agitaê')}">
      <div class="assist-head"><strong>${t('Assistente da Agitaê')}</strong><span class="meta">${t('Me conte sobre sua festa — eu ajudo a achar fornecedores no catálogo.')}</span></div>
      <div class="assist-body" id="assist-body" aria-live="polite">
        ${messages.length ? messages.map(bubble) : html`<p class="meta">${t('Ex.: "bolo para 20 pessoas em São Paulo" ou "fotógrafo disponível dia 20/12".')}</p>`}
        ${sending ? html`<div class="msg"><span class="meta">${t('Digitando…')}</span></div>` : ''}
      </div>
      <form class="assist-form" data-form="assist-send"><label class="meta" for="assist-input" style="position:absolute;left:-9999px">${t('Mensagem para o assistente')}</label><input id="assist-input" name="message" placeholder="${t('Escreva aqui…')}" autocomplete="off" ${sending ? 'disabled' : ''}><button class="btn sm" type="submit" ${sending ? 'disabled' : ''}>${t('Enviar')}</button></form>
    </div>` : ''}`.s;
  const body = document.getElementById('assist-body'); if (body) body.scrollTop = body.scrollHeight;
}
act('assist-toggle', () => {
  open = !open;
  if (open && !messages.length) track('assistant_opened');
  render();
  if (open) setTimeout(() => root.querySelector('#assist-input')?.focus(), 60);
});
act('assist-close', () => { open = false; render(); });
form('assist-send', async (d, f) => {
  const text = (d.message || '').trim(); if (!text || sending) return;
  messages.push({ role: 'user', text }); sending = true; render(); f.reset();
  track('assistant_message_sent', { conversation_id: convId });
  try {
    const r = await api('/assistant/message', { method: 'POST', body: { conversation_id: convId, message: text } });
    convId = r.conversation_id;
    messages.push({ role: 'assistant', text: r.reply, providers: r.providers });
    track('assistant_reply_received', { conversation_id: convId, providers_count: (r.providers || []).length });
  } catch (e) {
    messages.push({ role: 'assistant', text: e.message });
  } finally { sending = false; render(); }
});
export function mountAssistant() {
  if (root) return;
  root = document.createElement('div'); root.id = 'assistant-widget'; document.body.appendChild(root); render();
}
export const refreshAssistant = render; // recompõe os textos fixos (não as mensagens) ao trocar de idioma

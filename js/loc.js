// Localização do cliente (CEP, cidade ou bairro), compartilhada entre cabeçalho, home e busca.
import { api, html, act, form, store, toast, go, openDialog, closeDialog, errBox, t, icon, render } from './core.js';

export const savedLoc = () => store.get('loc') || {};
export function saveLoc(d) { if (d.loc || d.lat) store.set('loc', { q: d.loc, lat: d.lat, lng: d.lng }); }
export const locLabel = () => { const s = savedLoc(); return s.q || (s.lat ? t('Minha localização') : ''); };

export function locField(prefix = '', value = '', label = null) {
  const s = savedLoc();
  return html`<div class="field"><label for="${prefix}loc">${label || t('Onde será a festa?')} <span class="meta">(${t('CEP, cidade ou bairro')})</span></label>
    <div class="inline"><input id="${prefix}loc" name="loc" value="${value || s.q || ''}" placeholder="${t('Ex.: 01310-100, Rio de Janeiro ou Mooca')}" autocomplete="postal-code" data-locinput>
    <button class="btn ghost" type="button" data-act="geo" title="${t('Usar a localização do dispositivo (o navegador pedirá sua permissão)')}">${icon('pin', 18)}<span>${t('Usar minha localização')}</span></button></div>
    <input type="hidden" name="lat" value="${s.lat && !value ? s.lat : ''}" data-lat><input type="hidden" name="lng" value="${s.lng && !value ? s.lng : ''}" data-lng></div>`;
}
document.addEventListener('input', (e) => { if (e.target.matches('[data-locinput]')) { const f = e.target.closest('form'); f.querySelector('[data-lat]').value = ''; f.querySelector('[data-lng]').value = ''; } });
act('geo', (el) => new Promise((resolve) => {
  const f = el.closest('form');
  if (!navigator.geolocation) { toast(t('Seu navegador não oferece localização. Digite o CEP ou a cidade.'), true); return resolve(); }
  toast(t('Aguardando sua permissão para usar a localização…'));
  navigator.geolocation.getCurrentPosition(async (pos) => {
    try {
      const { location } = await api(`/locations/resolve?lat=${pos.coords.latitude}&lng=${pos.coords.longitude}`);
      f.querySelector('[data-locinput]').value = location?.label || t('Minha localização');
      f.querySelector('[data-lat]').value = pos.coords.latitude.toFixed(4); f.querySelector('[data-lng]').value = pos.coords.longitude.toFixed(4);
      toast(t('Localização definida: {l}', { l: location?.label || t('sua região') }));
    } catch (e) { toast(e.message, true); }
    resolve();
  }, () => { toast(t('Sem permissão de localização. Você pode digitar o CEP, a cidade ou o bairro.'), true); resolve(); }, { timeout: 10000 });
}));

act('loc-open', () => openDialog(t('Onde será a festa?'), html`<form class="grid" data-form="loc-set"><p class="meta">${t('Mostramos só fornecedores que atendem o local informado.')}</p>${locField('d-', '', t('Local do evento'))}${errBox()}<button class="btn orange block" type="submit">${t('Confirmar local')}</button><button class="btn ghost block" type="button" data-act="loc-clear">${t('Limpar local')}</button></form>`, 'loc'));
form('loc-set', async (d) => {
  if (d.loc && !d.lat) { const { location } = await api('/locations/resolve?q=' + encodeURIComponent(d.loc)); if (location?.kind === 'desconhecido') throw new Error(t('Não reconhecemos esse local. Tente um CEP completo, o nome da cidade ou o bairro.')); }
  saveLoc(d); closeDialog(); window.dispatchEvent(new Event('agitae:chrome')); render();
});
act('loc-clear', () => { store.del('loc'); closeDialog(); window.dispatchEvent(new Event('agitae:chrome')); render(); });

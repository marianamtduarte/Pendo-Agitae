// Internacionalização: o português é o idioma-fonte (chave). O inglês vem de js/en.js.
import EN from './en.js';

const saved = (() => { try { return localStorage.getItem('agitae.lang'); } catch { return null; } })();
export let lang = saved || ((navigator.language || 'pt').toLowerCase().startsWith('en') ? 'en' : 'pt');
document.documentElement.lang = lang === 'en' ? 'en' : 'pt-BR';

export function setLang(l) {
  lang = l === 'en' ? 'en' : 'pt';
  try { localStorage.setItem('agitae.lang', lang); } catch {}
  document.documentElement.lang = lang === 'en' ? 'en' : 'pt-BR';
}

/** t('Texto em português {n}', { n: 3 }) → texto no idioma atual. Sem tradução, cai para o português. */
export function t(pt, vars) {
  let s = lang === 'en' ? EN[pt] ?? pt : pt;
  if (vars) s = s.replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? ''));
  return s;
}
export const locale = () => (lang === 'en' ? 'en-US' : 'pt-BR');

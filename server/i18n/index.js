import EN_DATA from './en-data.js';
import EN_MSG from './messages-en.js';

const EN = { ...EN_DATA, ...EN_MSG };
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const templates = [];
for (const [pt, en] of Object.entries(EN)) {
  if (!pt.includes('{0}')) continue;
  const re = new RegExp('^' + esc(pt).replace(/\\\{(\d+)\\\}/g, '(?<g$1>[\\s\\S]*?)') + '$');
  templates.push({ re, en, weight: pt.replace(/\{\d+\}/g, '').length });
}
templates.sort((a, b) => b.weight - a.weight); // modelos mais específicos primeiro

/** Traduz uma string PT → outro idioma (exato, ou por modelo com valores). Sem tradução conhecida, devolve o original. */
export function tr(s, lang) {
  if (lang !== 'en' || typeof s !== 'string' || !s) return s;
  const hit = EN[s]; if (hit !== undefined) return hit;
  if (s.length > 400 || !/[a-zA-ZÀ-ú]/.test(s)) return s;
  for (const t of templates) {
    const m = t.re.exec(s); if (!m) continue;
    return t.en.replace(/\{(\d+)\}/g, (_, i) => tr(m.groups['g' + i] ?? '', lang));
  }
  return s;
}
/** Traduz recursivamente todas as strings de uma resposta JSON. */
export function localize(v, lang) {
  if (lang !== 'en') return v;
  if (typeof v === 'string') return tr(v, lang);
  if (Array.isArray(v)) return v.map((x) => localize(x, lang));
  if (v && typeof v === 'object') { const o = {}; for (const k of Object.keys(v)) o[k] = localize(v[k], lang); return o; }
  return v;
}

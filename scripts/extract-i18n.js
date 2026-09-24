// Lista as chaves t('…') usadas no frontend e aponta as que ainda não têm tradução em public/js/en.js
import fs from 'node:fs';
import path from 'node:path';
const dir = 'public/js';
const keys = new Set();
for (const f of fs.readdirSync(dir).filter((f) => f.endsWith('.js') && f !== 'en.js' && f !== 'i18n.js')) {
  const src = fs.readFileSync(path.join(dir, f), 'utf8');
  const re = /\bt\('((?:\\'|[^'])*)'/g; let m;
  while ((m = re.exec(src))) keys.add(m[1].replace(/\\'/g, "'"));
}
let en = {};
try { en = (await import(path.resolve(dir, 'en.js') + '?' + Date.now())).default; } catch {}
const missing = [...keys].filter((k) => !(k in en));
const unused = Object.keys(en).filter((k) => !keys.has(k));
if (process.argv.includes('--list')) fs.writeFileSync('/tmp/agitae-ui-keys.json', JSON.stringify(missing, null, 1));
console.log(`chaves: ${keys.size} · sem tradução: ${missing.length} · sobrando no dicionário: ${unused.length}`);
if (missing.length && !process.argv.includes('--list')) { console.log(missing.map((k) => '  - ' + k).join('\n')); process.exitCode = 1; }

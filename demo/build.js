// Gera dist-demo/: versão 100% estática (GitHub Pages) — o servidor roda no navegador. Uso: npm run build:demo
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'dist-demo'), here = (p) => path.join(root, 'demo', p);
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });

// migrações do banco embutidas como texto
const migs = fs.readdirSync(path.join(root, 'server/migrations')).filter((f) => f.endsWith('.sql')).sort();
fs.writeFileSync(here('migrations.generated.js'), '// gerado por demo/build.js\nexport const MIGRATIONS = ' + JSON.stringify(migs.map((n) => ({ name: n, sql: fs.readFileSync(path.join(root, 'server/migrations', n), 'utf8') })), null, 1) + ';\n');

const shim = { 'node:crypto': 'crypto.js', 'node:fs': 'fs.js', 'node:path': 'path.js', 'node:url': 'url.js' };
await build({
  entryPoints: [here('entry.js')], outfile: path.join(out, 'demo.js'), bundle: true, format: 'esm', platform: 'browser', target: 'es2022', minify: true, legalComments: 'none',
  inject: [here('globals.js')], define: { __BUILD_ID__: JSON.stringify(Date.now()), 'process.env.NODE_ENV': '"demo"' }, logLevel: 'warning',
  plugins: [{ name: 'node-shims', setup(b) {
    b.onResolve({ filter: /^node:/ }, (a) => { if (!shim[a.path]) throw new Error('Sem shim para ' + a.path); return { path: here('shims/' + shim[a.path]) }; });
    b.onResolve({ filter: /(^|\/)db\.js$/ }, (a) => (a.importer.includes(path.join('server', '')) ? { path: here('shims/db.js') } : null));
  } }],
});

// arquivos estáticos do site + wasm do SQLite
fs.cpSync(path.join(root, 'public'), out, { recursive: true });
fs.copyFileSync(path.join(root, 'node_modules/sql.js/dist/sql-wasm-browser.wasm'), path.join(out, 'sql-wasm-browser.wasm'));
let html = fs.readFileSync(path.join(out, 'index.html'), 'utf8');
if (!html.includes('src="js/app.js"')) throw new Error('index.html inesperado');
html = html.replace('<script type="module" src="js/app.js"></script>', '<script type="module" src="demo.js"></script>');
fs.writeFileSync(path.join(out, 'index.html'), html);
fs.writeFileSync(path.join(out, '.nojekyll'), '');
const size = (f) => (fs.statSync(path.join(out, f)).size / 1024).toFixed(0) + ' KB';
console.log(`dist-demo pronto: demo.js ${size('demo.js')} · wasm ${size('sql-wasm-browser.wasm')}`);

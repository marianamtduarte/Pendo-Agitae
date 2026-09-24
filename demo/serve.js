// Servidor estático para testar dist-demo localmente, também sob um subcaminho (como no GitHub Pages).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist-demo');
const base = process.env.BASE || '/Pendo-Agitae', port = Number(process.env.PORT || 4173);
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.svg': 'image/svg+xml', '.wasm': 'application/wasm' };
http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p === '/' || p === base) { res.writeHead(302, { Location: base + '/' }); return res.end(); }
  if (!p.startsWith(base + '/')) { res.writeHead(404); return res.end('fora do subcaminho'); }
  p = p.slice(base.length); if (p.endsWith('/')) p += 'index.html';
  const f = path.join(dir, p);
  if (!f.startsWith(dir) || !fs.existsSync(f)) { res.writeHead(404); return res.end('404'); }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store' }); fs.createReadStream(f).pipe(res);
}).listen(port, () => console.log(`demo em http://localhost:${port}${base}/`));

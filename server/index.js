import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
// Carrega .env simples (sem dependências)
try {
  for (const line of fs.readFileSync(path.join(root, '.env'), 'utf8').split('\n')) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (m && !line.trim().startsWith('#') && process.env[m[1]] === undefined) process.env[m[1]] = m[2];
  }
} catch {}

const { openDb } = await import('./db.js');
const { createApp } = await import('./app.js');

export function start({ port = Number(process.env.PORT || 3000), dbFile = process.env.DATABASE_FILE || './data/agitae.db', uploadDir = process.env.UPLOAD_DIR || './data/uploads' } = {}) {
  dbFile = dbFile === ':memory:' ? dbFile : path.resolve(root, dbFile);
  uploadDir = path.resolve(root, uploadDir);
  fs.mkdirSync(uploadDir, { recursive: true });
  const db = openDb(dbFile);
  return { db, uploadDir, port, dbFile };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { db, uploadDir, port } = start();
  if (process.env.NODE_ENV !== 'production' && process.env.SEED_DEMO !== '0' && !db.prepare('SELECT 1 FROM users LIMIT 1').get()) {
    const { seed } = await import('./seed.js');
    seed(db);
    console.log('Banco vazio: dados fictícios de demonstração carregados.');
  }
  const server = http.createServer(createApp(db, { uploadDir }));
  server.listen(port, () => console.log(`Agitaê rodando em http://localhost:${port}  (pagamentos: ${process.env.PAYMENT_MODE || 'test'})`));
  const stop = () => { server.close(() => { db.close(); process.exit(0); }); };
  process.on('SIGINT', stop); process.on('SIGTERM', stop);
}

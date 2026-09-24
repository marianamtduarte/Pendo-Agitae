// Backup consistente do SQLite (VACUUM INTO) com retenção. Agende via cron: 0 3 * * * cd /app && node scripts/backup.js
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
try { process.loadEnvFile(path.join(root, '.env')); } catch {}
const file = path.resolve(root, process.env.DATABASE_FILE || './data/agitae.db');
const dir = path.resolve(root, process.env.BACKUP_DIR || './data/backups'), keep = Number(process.env.BACKUP_KEEP || 14);
fs.mkdirSync(dir, { recursive: true });
const out = path.join(dir, `agitae-${new Date().toISOString().replace(/[:.]/g, '-')}.db`);
const db = new DatabaseSync(file);
db.exec(`VACUUM INTO '${out.replace(/'/g, "''")}'`);
db.close();
const olds = fs.readdirSync(dir).filter((f) => f.endsWith('.db')).sort().reverse().slice(keep);
for (const f of olds) fs.rmSync(path.join(dir, f));
console.log(`Backup criado: ${out} (${olds.length} antigo(s) removido(s))`);

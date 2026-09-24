import crypto from 'node:crypto';

export class HttpError extends Error {
  constructor(status, message, details) { super(message); this.status = status; this.details = details; }
}
export const bad = (m, d) => new HttpError(400, m, d);

// ---------- validação (sempre repetida no servidor) ----------
export function str(v, name, { min = 0, max = 2000, optional = false } = {}) {
  if (v === undefined || v === null || v === '') {
    if (optional) return null;
    throw bad(`Preencha o campo "${name}".`);
  }
  if (typeof v !== 'string') throw bad(`Valor inválido em "${name}".`);
  const s = v.trim();
  if (s.length < min) throw bad(`"${name}" precisa ter ao menos ${min} caracteres.`);
  if (s.length > max) throw bad(`"${name}" pode ter no máximo ${max} caracteres.`);
  return s;
}
export function int(v, name, { min = 0, max = 1e9, optional = false } = {}) {
  if (v === undefined || v === null || v === '') {
    if (optional) return null;
    throw bad(`Informe "${name}".`);
  }
  const n = Number(v);
  if (!Number.isInteger(n) || n < min || n > max) throw bad(`"${name}" deve ser um número inteiro entre ${min} e ${max}.`);
  return n;
}
export function date(v, name, { optional = false } = {}) {
  if (!v) { if (optional) return null; throw bad(`Informe "${name}".`); }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v) || Number.isNaN(Date.parse(v + 'T12:00:00Z'))) throw bad(`Data inválida em "${name}".`);
  return v;
}
export function email(v) {
  const s = str(v, 'e-mail', { max: 200 }).toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s)) throw bad('E-mail inválido.');
  return s;
}
export const oneOf = (v, list, name) => { if (!list.includes(v)) throw bad(`Valor inválido em "${name}".`); return v; };

// ---------- datas ----------
export const today = () => new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10); // horário de Brasília (UTC-3)
export function addDays(d, n) { const t = new Date(d + 'T12:00:00Z'); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); }
export const daysBetween = (a, b) => Math.round((Date.parse(b + 'T12:00:00Z') - Date.parse(a + 'T12:00:00Z')) / 864e5);

// ---------- texto / geo ----------
export const slugify = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
export function haversine(lat1, lng1, lat2, lng2) {
  const r = (x) => (x * Math.PI) / 180, R = 6371;
  const a = Math.sin(r(lat2 - lat1) / 2) ** 2 + Math.cos(r(lat1)) * Math.cos(r(lat2)) * Math.sin(r(lng2 - lng1) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

// ---------- senhas e tokens ----------
export function hashPassword(pw) {
  const salt = crypto.randomBytes(16);
  return `scrypt$${salt.toString('hex')}$${crypto.scryptSync(pw, salt, 64).toString('hex')}`;
}
export function verifyPassword(pw, stored) {
  const [alg, salt, hash] = String(stored).split('$');
  if (alg !== 'scrypt') return false;
  const h = crypto.scryptSync(pw, Buffer.from(salt, 'hex'), 64);
  return crypto.timingSafeEqual(h, Buffer.from(hash, 'hex'));
}
export const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');
export const randomToken = (n = 32) => crypto.randomBytes(n).toString('base64url');

// ---------- efeitos colaterais: auditoria, notificações, e-mail ----------
export function audit(db, actorId, action, entity, entityId, detail) {
  db.prepare('INSERT INTO audit_log(actor_id,action,entity,entity_id,detail) VALUES(?,?,?,?,?)')
    .run(actorId ?? null, action, entity ?? null, entityId ?? null, detail ? JSON.stringify(detail) : null);
}
export function notify(db, userId, title, body, link) {
  if (!userId) return;
  db.prepare('INSERT INTO notifications(user_id,title,body,link) VALUES(?,?,?,?)').run(userId, title, body ?? null, link ?? null);
  const u = db.prepare('SELECT email FROM users WHERE id=? AND deleted_at IS NULL').get(userId);
  if (u) sendEmail(db, u.email, title, `${body || ''}\n\n${link ? (process.env.PUBLIC_URL || '') + '/#' + link : ''}`);
}
export function sendEmail(db, to, subject, body) {
  // Sem SMTP configurado, o e-mail fica na caixa de saída (tabela emails) e no log.
  db.prepare('INSERT INTO emails(to_addr,subject,body) VALUES(?,?,?)').run(to, subject, body);
  if (process.env.LOG_EMAILS === '1') console.log(JSON.stringify({ level: 'info', msg: 'email-outbox', to, subject }));
}
export const getSetting = (db, key, def) => db.prepare('SELECT value FROM settings WHERE key=?').get(key)?.value ?? def;
export const money = (c) => (c / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

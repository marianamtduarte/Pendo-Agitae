// Substitui server/db.js na demo: o banco é o SQLite em WebAssembly (sql.js), criado em demo/entry.js.
export function tx(db, fn) {
  db.exec('BEGIN IMMEDIATE');
  try { const r = fn(); db.exec('COMMIT'); return r; }
  catch (e) { try { db.exec('ROLLBACK'); } catch {} throw e; }
}
export function openDb() { throw new Error('openDb não é usado na demonstração online.'); }

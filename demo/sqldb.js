// Adaptador: expõe a mesma API síncrona do node:sqlite (prepare().get/all/run e exec) sobre o sql.js.
const norm = (p) => p.map((v) => (v === undefined ? null : typeof v === 'boolean' ? +v : v));

export class SqlDb {
  constructor(SQL, data) { this.db = data ? new SQL.Database(data) : new SQL.Database(); this.db.run('PRAGMA foreign_keys=ON'); }
  exec(sql) { this.db.exec(sql); }
  prepare(sql) {
    const db = this.db;
    const all = (...p) => { const s = db.prepare(sql); try { s.bind(norm(p)); const rows = []; while (s.step()) rows.push(s.getAsObject()); return rows; } finally { s.free(); } };
    return {
      all,
      get: (...p) => all(...p)[0],
      run: (...p) => { db.run(sql, norm(p)); return { changes: db.getRowsModified(), lastInsertRowid: db.exec('SELECT last_insert_rowid()')[0].values[0][0] }; },
    };
  }
  export() { const d = this.db.export(); this.db.run('PRAGMA foreign_keys=ON'); return d; } // export() reinicia os pragmas
}

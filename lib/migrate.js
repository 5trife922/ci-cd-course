const fs = require('fs');
const path = require('path');

/**
 * Применяет SQL-миграции из каталога migrations (порядок — по имени файла).
 * @param {*} db Экземпляр better-sqlite3 Database.
 * @param {string} migrationsDir Абсолютный путь к папке с .sql.
 */
function runMigrations(db, migrationsDir) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filename TEXT NOT NULL UNIQUE,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
 
  const list = fs
      .readdirSync(migrationsDir)
      .filter((name) => name.endsWith('.sql'))
      .sort();

  const rows = db.prepare('SELECT filename FROM schema_migrations').all();
  const applied = new Set(rows.map((row) => row.filename));

  const insert = db.prepare(
      'INSERT INTO schema_migrations (filename) VALUES (@filename)',
  );

  for (const filename of list) {
    if (applied.has(filename)) continue;

    const fullPath = path.join(migrationsDir, filename);
    const sql = fs.readFileSync(fullPath, 'utf8');
    db.exec(sql);
    insert.run({filename});
  }
}

module.exports = {runMigrations};

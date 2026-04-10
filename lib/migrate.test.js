const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const {runMigrations} = require('./migrate');

const migrationsDir = path.join(__dirname, '..', 'migrations');

describe('runMigrations', () => {
  let db;

  beforeEach(() => {
    db = new Database(':memory:');
  });

  afterEach(() => {
    db.close();
  });

  it('создаёт таблицу todos и записывает миграцию', () => {
    runMigrations(db, migrationsDir);

    const table = db.prepare(
        `SELECT name FROM sqlite_master
         WHERE type = 'table' AND name = 'todos'`,
    ).get();
    expect(table).toEqual({name: 'todos'});

    const applied = db.prepare(
        'SELECT filename FROM schema_migrations ORDER BY filename',
    ).all();
    expect(applied.length).toBeGreaterThan(0);
    expect(applied.some((row) => row.filename.endsWith('.sql'))).toBe(true);
  });

  it('повторный запуск не дублирует миграции', () => {
    runMigrations(db, migrationsDir);
    const first = db.prepare(
        'SELECT COUNT(*) AS n FROM schema_migrations',
    ).get();

    runMigrations(db, migrationsDir);
    const second = db.prepare(
        'SELECT COUNT(*) AS n FROM schema_migrations',
    ).get();

    expect(second.n).toBe(first.n);
  });

  it('при новом .sql в каталоге применяет его', () => {
    const tmp = fs.mkdtempSync(path.join(__dirname, 'tmp-migrate-'));
    try {
      fs.copyFileSync(
          path.join(migrationsDir, '001_create_todos.sql'),
          path.join(tmp, '001_create_todos.sql'),
      );
      fs.writeFileSync(
          path.join(tmp, '002_add_note.sql'),
          'ALTER TABLE todos ADD COLUMN note TEXT;\n',
          'utf8',
      );

      runMigrations(db, tmp);
      runMigrations(db, tmp);

      const cols = db.prepare('PRAGMA table_info(todos)').all();
      const names = cols.map((c) => c.name);
      expect(names).toContain('note');
    } finally {
      fs.rmSync(tmp, {recursive: true, force: true});
    }
  });
});

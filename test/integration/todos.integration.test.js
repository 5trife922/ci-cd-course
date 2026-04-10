const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');
const {once} = require('events');
const request = require('supertest');
const Database = require('better-sqlite3');
const {runMigrations} = require('../../lib/migrate');
const {createApp} = require('../../lib/app');

const migrationsDir = path.join(__dirname, '..', '..', 'migrations');

describe('Integration: файловая SQLite и HTTP', () => {
  let tmpDir;
  let dbPath;
  let db;
  let app;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'todo-int-'));
    dbPath = path.join(tmpDir, 'todo.db');
    db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    runMigrations(db, migrationsDir);
    app = createApp(db, {serveStatic: false});
  });

  afterEach(() => {
    if (db) {
      db.close();
    }
    if (tmpDir && fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, {recursive: true, force: true});
    }
  });

  it('персистентность: CRUD и повторное открытие файла БД', async () => {
    await request(app).post('/api/todos').send({title: 'А'}).expect(201);
    await request(app)
        .patch('/api/todos/1')
        .send({completed: true})
        .expect(200);

    db.close();
    db = new Database(dbPath);
    runMigrations(db, migrationsDir);
    app = createApp(db, {serveStatic: false});

    const res = await request(app).get('/api/todos').expect(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].title).toBe('А');
    expect(res.body[0].completed).toBe(1);
  });

  it('несколько задач и удаление сохраняются между сессиями БД', async () => {
    await request(app).post('/api/todos').send({title: 'один'}).expect(201);
    await request(app).post('/api/todos').send({title: 'два'}).expect(201);

    db.close();
    db = new Database(dbPath);
    runMigrations(db, migrationsDir);
    app = createApp(db, {serveStatic: false});

    let res = await request(app).get('/api/todos').expect(200);
    expect(res.body).toHaveLength(2);

    await request(app).delete('/api/todos/1').expect(204);

    db.close();
    db = new Database(dbPath);
    runMigrations(db, migrationsDir);
    app = createApp(db, {serveStatic: false});

    res = await request(app).get('/api/todos').expect(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].title).toBe('два');
  });

  it('тот же app отвечает по реальному TCP (не только supertest)', async () => {
    const server = http.createServer(app);
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');

    const addr = server.address();
    const port = addr && addr.port;
    expect(port).toBeGreaterThan(0);

    try {
      const res = await fetch(
          `http://127.0.0.1:${port}/api/todos`,
      );
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toEqual([]);
    } finally {
      server.close();
      await once(server, 'close');
    }
  });
});

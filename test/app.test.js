const path = require('path');
const request = require('supertest');
const Database = require('better-sqlite3');
const {runMigrations} = require('../lib/migrate');
const {createApp} = require('../lib/app');

const migrationsDir = path.join(__dirname, '..', 'migrations');

describe('API /api/todos', () => {
  let db;
  let app;

  beforeEach(() => {
    db = new Database(':memory:');
    runMigrations(db, migrationsDir);
    app = createApp(db, {serveStatic: false});
  });

  afterEach(() => {
    db.close();
  });

  it('GET возвращает пустой массив', async () => {
    const res = await request(app).get('/api/todos').expect(200);
    expect(res.body).toEqual([]);
  });

  it('POST создаёт задачу', async () => {
    const res = await request(app)
        .post('/api/todos')
        .send({title: '  Учить Jest  '})
        .expect(201);
    expect(res.body.title).toBe('Учить Jest');
    expect(res.body.completed).toBe(1);
    expect(res.body.id).toBe(1);
  });

  it('POST без title — 400', async () => {
    await request(app).post('/api/todos').send({}).expect(400);
  });

  it('PATCH переключает completed', async () => {
    await request(app).post('/api/todos').send({title: 'a'}).expect(201);
    const res = await request(app)
        .patch('/api/todos/1')
        .send({completed: true})
        .expect(200);
    expect(res.body.completed).toBe(1);
  });

  it('DELETE удаляет задачу', async () => {
    await request(app).post('/api/todos').send({title: 'x'}).expect(201);
    await request(app).delete('/api/todos/1').expect(204);
    const list = await request(app).get('/api/todos').expect(200);
    expect(list.body).toEqual([]);
  });

  it('PATCH несуществующего id — 404', async () => {
    await request(app)
        .patch('/api/todos/99')
        .send({completed: true})
        .expect(404);
  });
});

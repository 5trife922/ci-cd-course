const path = require('path');
const express = require('express');

/**
 * Собирает Express-приложение с API задач.
 * @param {*} db Экземпляр better-sqlite3 после миграций.
 * @param {Object=} options Опции.
 * @param {boolean=} options.serveStatic Раздавать public (по умолчанию да).
 * @return {Object} Приложение Express.
 */
function createApp(db, options) {
  const opts = options || {};
  const serveStatic = opts.serveStatic !== false;

  const app = express();
  app.use(express.json({limit: '32kb'}));
  if (serveStatic) {
    app.use(express.static(path.join(__dirname, '..', 'public')));
  }

  const listStmt = db.prepare(
      'SELECT id, title, completed, created_at ' +
      'FROM todos ORDER BY created_at DESC',
  );
  const insertStmt = db.prepare(
      'INSERT INTO todos (title) VALUES (@title) ' +
      'RETURNING id, title, completed, created_at',
  );
  const updateStmt = db.prepare(
      `UPDATE todos SET
    title = COALESCE(@title, title),
    completed = COALESCE(@completed, completed)
   WHERE id = @id
   RETURNING id, title, completed, created_at`,
  );
  const deleteStmt = db.prepare('DELETE FROM todos WHERE id = ?');

  app.get('/api/todos', (_req, res) => {
    res.json(listStmt.all());
  });

  app.post('/api/todos', (req, res) => {
    const title = req.body && String(req.body.title || '').trim();
    if (!title) {
      res.status(400).json({error: 'Нужен непустой title'});
      return;
    }
    const row = insertStmt.get({title});
    res.status(201).json(row);
  });

  app.patch('/api/todos/:id', (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
      res.status(400).json({error: 'Некорректный id'});
      return;
    }
    const body = req.body || {};
    const title =
      body.title === undefined ? null : String(body.title).trim() || null;
    const completed =
      body.completed === undefined ? null : body.completed ? 1 : 0;

    if (title === null && completed === null) {
      res.status(400).json({error: 'Укажите title или completed'});
      return;
    }

    const row = updateStmt.get({id, title, completed});
    if (!row) {
      res.status(404).json({error: 'Задача не найдена'});
      return;
    }
    res.json(row);
  });

  app.delete('/api/todos/:id', (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
      res.status(400).json({error: 'Некорректный id'});
      return;
    }
    const info = deleteStmt.run(id);
    if (info.changes === 0) {
      res.status(404).json({error: 'Задача не найдена'});
      return;
    }
    res.status(204).end();
  });

  return app;
}

module.exports = {createApp};

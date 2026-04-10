const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const {runMigrations} = require('./lib/migrate');
const {createApp} = require('./lib/app');

const PORT = Number(process.env.PORT) || 3000;
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'data', 'todo.db');
const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

fs.mkdirSync(path.dirname(DB_PATH), {recursive: true});

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
runMigrations(db, MIGRATIONS_DIR);

const app = createApp(db);

app.listen(PORT, () => {
  console.log(`http://localhost:${PORT}`);
});

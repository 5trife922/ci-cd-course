'use strict';

const path = require('path');
const os = require('os');

/** Путь к файлу БД для e2e (совпадает с playwright.config и global-setup). */
const E2E_DB = path.join(os.tmpdir(), 'sqlite-todo-e2e.db');

module.exports = {E2E_DB};

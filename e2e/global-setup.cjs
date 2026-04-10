'use strict';

const fs = require('fs');
const {E2E_DB} = require('./paths.cjs');

/**
 * Удаляет файл БД e2e, чтобы прогон начинался с чистого состояния.
 * @return {!Promise<void>}
 */
module.exports = async function globalSetup() {
  const extras = [E2E_DB + '-wal', E2E_DB + '-shm'];
  for (const p of [E2E_DB, ...extras]) {
    try {
      fs.unlinkSync(p);
    } catch (e) {
      if (e.code !== 'ENOENT') {
        throw e;
      }
    }
  }
};

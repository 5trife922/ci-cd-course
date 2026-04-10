'use strict';

const {E2E_DB} = require('./e2e/paths.cjs');

/** @type {import('@playwright/test').PlaywrightTestConfig} */
module.exports = {
  testDir: './e2e',
  globalSetup: require.resolve('./e2e/global-setup.cjs'),
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'node server.js',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 60 * 1000,
    env: {
      ...process.env,
      PORT: '4173',
      DB_PATH: E2E_DB,
    },
  },
};

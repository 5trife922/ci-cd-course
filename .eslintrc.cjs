'use strict';

module.exports = {
  root: true,
  extends: ['google'],
  ignorePatterns: [
    'node_modules/',
    'data/',
    'coverage/',
    'playwright-report/',
    'test-results/',
  ],
  overrides: [
    {
      files: ['server.js', 'lib/**/*.js'],
      env: { es2022: true, node: true },
      rules: {
        'no-unused-vars': [
          'error',
          { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
        ],
      },
    },
    {
      files: ['public/**/*.js'],
      env: { es2022: true, browser: true },
      rules: {
        'no-alert': 'off',
      },
    },
    {
      files: ['**/*.test.js'],
      env: { es2022: true, node: true, jest: true },
      rules: {
        'require-jsdoc': 'off',
      },
    },
    {
      files: ['e2e/**/*.js', 'playwright.config.cjs'],
      env: { es2022: true, node: true },
      rules: {
        'require-jsdoc': 'off',
      },
    },
  ],
};

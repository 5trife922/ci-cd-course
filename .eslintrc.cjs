'use strict';

module.exports = {
  root: true,
  extends: ['google'],
  ignorePatterns: ['node_modules/', 'data/'],
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
  ],
};

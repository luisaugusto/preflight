// Flat ESLint config for the Preflight Expo app.
//
// Extends Expo's SDK 57 base config, which wires up the TypeScript, React,
// React Hooks, import, and Expo plugins with sensible defaults. We layer
// eslint-config-prettier on top so ESLint stops enforcing stylistic rules that
// Prettier already owns — Prettier is the single source of truth for format.
//
// Docs: https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const eslintConfigPrettier = require('eslint-config-prettier');

module.exports = defineConfig([
  expoConfig,
  eslintConfigPrettier,
  {
    // Build output, generated native projects, and the Sanity Studio
    // sub-package (its own toolchain and lockfile) are outside this lint scope.
    ignores: ['dist/**', 'web-build/**', '.expo/**', 'android/**', 'ios/**', 'studio/**'],
  },
]);

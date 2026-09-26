// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*', 'node_modules/*', '.expo/*', 'supabase/functions/*'],
  },
  {
    rules: {
      // Prevents crashes from `{count && ...}` rendering a raw `0`.
      'react/jsx-no-leaked-render': ['warn', { validStrategies: ['ternary'] }],
    },
  },
]);

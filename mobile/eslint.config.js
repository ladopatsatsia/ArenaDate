const js = require('@eslint/js');
const ts = require('typescript-eslint');
module.exports = ts.config(
  { ignores: ['dist/**', '.expo/**', 'node_modules/**', '.tools/**', '*.js', '*.cjs'] },
  js.configs.recommended,
  ...ts.configs.recommended,
  { languageOptions: { globals: { __DEV__: 'readonly', fetch: 'readonly', AbortController: 'readonly', AbortSignal: 'readonly', URL: 'readonly', setTimeout: 'readonly', clearTimeout: 'readonly', process: 'readonly', require: 'readonly', global: 'readonly' } } },
  { files: ['tests/**'], rules: { '@typescript-eslint/no-require-imports': 'off' } }
);

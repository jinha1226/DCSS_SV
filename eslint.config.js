import js from '@eslint/js';
import ts from 'typescript-eslint';

export default ts.config(
  { ignores: ['dist', 'node_modules', 'src/data/tiles.gen.ts'] },
  js.configs.recommended,
  ...ts.configs.recommended,
  {
    rules: {
      // A file past 500 lines is doing more than one job.
      'max-lines': ['error', { max: 500 }],
      eqeqeq: ['error', 'always'],
    },
  },
  {
    files: ['tools/**/*.mjs'],
    languageOptions: { globals: { process: 'readonly', console: 'readonly', URL: 'readonly' } },
  },
);

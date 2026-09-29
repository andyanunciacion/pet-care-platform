// @ts-check
import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import { defineConfig, globalIgnores } from 'eslint/config';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/**
 * Shared ESLint flat config. Each package's eslint.config.js extends it and sets
 * `tsconfigRootDir` so type-aware rules find that package's tsconfig.json:
 *
 *   export default defineConfig(base, {
 *     languageOptions: { parserOptions: { tsconfigRootDir: import.meta.dirname } },
 *   });
 */
export default defineConfig(
  globalIgnores(['**/dist/', '**/.next/', '**/.turbo/', '**/coverage/']),
  js.configs.recommended,
  // "Type-checked" rules use the TypeScript compiler, so they catch things like
  // un-awaited promises that syntax-only linting can't see.
  tseslint.configs.strictTypeChecked,
  {
    languageOptions: {
      globals: globals.node,
      parserOptions: { projectService: true },
    },
    rules: {
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
    },
  },
  {
    // Plain JS files (mostly tool configs) get the basic rules only.
    files: ['**/*.{js,mjs,cjs}'],
    extends: [tseslint.configs.disableTypeChecked],
  },
  // Must come last: turns off style rules that Prettier owns.
  prettier,
);

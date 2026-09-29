import { defineConfig } from 'eslint/config';
import base from './eslint.js';

export default defineConfig(base, {
  languageOptions: { parserOptions: { tsconfigRootDir: import.meta.dirname } },
});

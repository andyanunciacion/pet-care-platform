import base from '@paw/config/eslint';
import { defineConfig, globalIgnores } from 'eslint/config';

export default defineConfig(base, globalIgnores(['src/schema.ts']), {
  languageOptions: { parserOptions: { tsconfigRootDir: import.meta.dirname } },
});

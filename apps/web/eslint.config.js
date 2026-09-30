import base from '@paw/config/eslint';
import nextVitals from 'eslint-config-next/core-web-vitals';
import { defineConfig, globalIgnores } from 'eslint/config';

export default defineConfig(
  // Next.js, React, React Hooks and accessibility (jsx-a11y) rules.
  nextVitals,
  base,
  globalIgnores(['.next/', 'next-env.d.ts']),
  {
    languageOptions: { parserOptions: { tsconfigRootDir: import.meta.dirname } },
    // eslint-plugin-react's "detect" calls an API removed in ESLint 10; name the version instead.
    settings: { react: { version: '19.3' } },
  },
);

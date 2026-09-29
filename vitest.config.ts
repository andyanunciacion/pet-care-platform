import { defineConfig } from 'vitest/config';

// One Vitest run covers every app and package: each folder is a "project".
// A package only needs its own vitest.config.ts when it differs from the defaults
// (e.g. a browser-like environment for apps/web).
export default defineConfig({
  test: {
    projects: ['{apps,packages}/*'],
  },
});

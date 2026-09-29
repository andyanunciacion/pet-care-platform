import { defineProject } from 'vitest/config';

export default defineProject({
  test: {
    // Gives this package's tests a fresh, migrated database (see src/testing).
    globalSetup: ['./src/testing/global-setup.ts'],
  },
});

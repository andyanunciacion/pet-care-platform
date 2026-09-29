import { defineProject } from 'vitest/config';

export default defineProject({
  test: {
    // Gives the API's tests a fresh, migrated database (see packages/db/src/testing).
    globalSetup: ['@paw/db/testing/global-setup'],
  },
});

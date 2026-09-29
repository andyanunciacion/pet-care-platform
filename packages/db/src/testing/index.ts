import { inject } from 'vitest';
import './context.ts';

/**
 * URL of this test run's fresh database. Only works in packages whose
 * vitest.config.ts lists "@paw/db/testing/global-setup" as globalSetup.
 */
export function testDatabaseUrl(): string {
  return inject('databaseUrl');
}

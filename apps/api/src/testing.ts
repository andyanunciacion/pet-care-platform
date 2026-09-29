import { testDatabaseUrl } from '@paw/db/testing';
import { parseEnv, type Env } from './env.ts';

/**
 * A valid Env for tests, pointing at this test run's fresh database.
 * Pass overrides for the variables a test cares about.
 */
export function testEnv(overrides: Record<string, string> = {}): Env {
  return parseEnv({
    NODE_ENV: 'test',
    LOG_LEVEL: 'silent',
    DATABASE_URL: testDatabaseUrl(),
    ...overrides,
  });
}

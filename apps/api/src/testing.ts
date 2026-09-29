import { parseEnv, type Env } from './env.ts';

/** Local Docker database (docker-compose.yml). CI overrides it with DATABASE_URL. */
const LOCAL_DATABASE_URL = 'postgres://paw:paw@localhost:5432/paw';

/** A valid Env for tests; pass overrides for the variables a test cares about. */
export function testEnv(overrides: Record<string, string> = {}): Env {
  return parseEnv({
    NODE_ENV: 'test',
    LOG_LEVEL: 'silent',
    DATABASE_URL: process.env.DATABASE_URL ?? LOCAL_DATABASE_URL,
    ...overrides,
  });
}

import { testDatabaseUrl } from '@paw/db/testing';
import { makeSignature } from 'better-auth/crypto';
import type { FastifyInstance } from 'fastify';
import { parseEnv, type Env } from './env.ts';
import { placeholderSecrets } from './placeholder-secrets.ts';

/**
 * A valid Env for tests, pointing at this test run's fresh database.
 * Pass overrides for the variables a test cares about.
 */
export function testEnv(overrides: Record<string, string> = {}): Env {
  return parseEnv({
    NODE_ENV: 'test',
    LOG_LEVEL: 'silent',
    DATABASE_URL: testDatabaseUrl(),
    ...placeholderSecrets,
    ...overrides,
  });
}

/**
 * Signs in as an existing user without going through Google: creates a session the way
 * Better Auth does and returns the signed cookie header for `app.inject({ headers })`.
 */
export async function sessionCookie(app: FastifyInstance, userId: string): Promise<string> {
  const context = await app.auth.$context;
  const { token } = await context.internalAdapter.createSession(userId);
  const signature = await makeSignature(token, context.secret);
  return `${context.authCookies.sessionToken.name}=${token}.${signature}`;
}

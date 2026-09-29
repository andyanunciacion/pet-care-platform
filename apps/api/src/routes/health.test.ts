import { afterEach, describe, expect, it } from 'vitest';
import { buildApp } from '../app.ts';
import { testEnv } from '../testing.ts';

// Integration tests: real Fastify app, real Postgres (start it with `docker compose up -d`).
describe('GET /health', () => {
  let app: Awaited<ReturnType<typeof buildApp>> | undefined;
  afterEach(async () => {
    await app?.close();
  });

  it('returns 200 when the database is reachable', async () => {
    app = await buildApp({ env: testEnv() });
    const response = await app.inject({ method: 'GET', url: '/health' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: 'ok', checks: { database: 'ok' } });
  });

  it('returns 503 when the database is unreachable', async () => {
    // Nothing listens on port 1, so the connection is refused.
    app = await buildApp({ env: testEnv({ DATABASE_URL: 'postgres://paw:paw@127.0.0.1:1/paw' }) });
    const response = await app.inject({ method: 'GET', url: '/health' });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({ status: 'error', checks: { database: 'error' } });
  });
});

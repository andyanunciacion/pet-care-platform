import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { buildApp } from './app.ts';
import type { Database } from './db.ts';
import type { Problem } from './errors.ts';
import { testEnv } from './testing.ts';

// These tests don't need a real database.
const fakeDatabase: Database = { ping: () => Promise.resolve(), close: () => Promise.resolve() };

let app: Awaited<ReturnType<typeof buildApp>>;

beforeAll(async () => {
  app = await buildApp({ env: testEnv(), database: fakeDatabase });
  // Test-only routes to exercise the error handler.
  app.get(
    '/test/validated',
    { schema: { querystring: z.object({ radius_km: z.coerce.number().positive() }) } },
    () => ({ ok: true }),
  );
  app.get('/test/crash', () => {
    throw new Error('connection string postgres://paw:secret@db leaked');
  });
});

afterAll(async () => {
  await app.close();
});

describe('error responses (RFC 9457 problem+json)', () => {
  it('404 for an unknown route', async () => {
    const response = await app.inject({ method: 'GET', url: '/nope?q=private' });

    expect(response.statusCode).toBe(404);
    expect(response.headers['content-type']).toMatch(/^application\/problem\+json/);
    expect(response.json()).toEqual({
      type: 'about:blank',
      title: 'Not Found',
      status: 404,
      detail: 'No route for GET /nope',
    });
  });

  it('400 with a list of invalid inputs', async () => {
    const response = await app.inject({ method: 'GET', url: '/test/validated?radius_km=-5' });

    expect(response.statusCode).toBe(400);
    expect(response.headers['content-type']).toMatch(/^application\/problem\+json/);
    const body = response.json<Problem>();
    expect(body).toMatchObject({ title: 'Bad Request', status: 400 });
    expect(body.errors).toHaveLength(1);
    expect(body.errors?.[0]).toMatchObject({ location: 'querystring', pointer: '/radius_km' });
    expect(body.errors?.[0]?.message).toBeTruthy();
  });

  it('500 without leaking internal details', async () => {
    const response = await app.inject({ method: 'GET', url: '/test/crash' });

    expect(response.statusCode).toBe(500);
    expect(response.json()).toEqual({
      type: 'about:blank',
      title: 'Internal Server Error',
      status: 500,
    });
    expect(response.body).not.toContain('secret');
  });
});

describe('security headers', () => {
  it('sets helmet headers', async () => {
    const response = await app.inject({ method: 'GET', url: '/health' });
    expect(response.headers['x-content-type-options']).toBe('nosniff');
  });

  it('allows CORS only from configured origins', async () => {
    const allowed = await app.inject({
      method: 'GET',
      url: '/health',
      headers: { origin: 'http://localhost:3000' },
    });
    const other = await app.inject({
      method: 'GET',
      url: '/health',
      headers: { origin: 'https://evil.example' },
    });

    expect(allowed.headers['access-control-allow-origin']).toBe('http://localhost:3000');
    expect(other.headers['access-control-allow-origin']).toBeUndefined();
  });
});

describe('OpenAPI', () => {
  it('documents /health from its Zod schema', () => {
    const spec = app.swagger();
    expect(spec.paths?.['/health']?.get?.responses).toHaveProperty('200');
    expect(spec.paths?.['/health']?.get?.responses).toHaveProperty('503');
  });
});

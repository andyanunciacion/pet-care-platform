import { createDatabase, schema } from '@paw/db';
import { insertTestUser, testDatabaseUrl } from '@paw/db/testing';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../app.ts';
import { sessionCookie, testEnv } from '../testing.ts';

type App = Awaited<ReturnType<typeof buildApp>>;

let app: App;
const database = createDatabase({ connectionString: testDatabaseUrl() });
const webOrigin = 'http://localhost:3000';
const json = { origin: webOrigin, 'content-type': 'application/json' };

beforeAll(async () => {
  app = await buildApp({ env: testEnv({ BETTER_AUTH_URL: webOrigin }) });
});

afterAll(async () => {
  await app.close();
  await database.close();
});

async function roleOf(userId: string) {
  const [row] = await database.db
    .select({ platformRole: schema.user.platformRole })
    .from(schema.user)
    .where(eq(schema.user.id, userId));
  return row?.platformRole;
}

describe('/v1/auth/* (Better Auth)', () => {
  it('starts Google sign-in with a callback on the web origin', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/v1/auth/sign-in/social',
      headers: json,
      payload: JSON.stringify({ provider: 'google', callbackURL: '/admin' }),
    });

    expect(response.statusCode).toBe(200);
    const google = new URL(response.json<{ url: string }>().url);
    expect(google.hostname).toBe('accounts.google.com');
    expect(google.searchParams.get('redirect_uri')).toBe(`${webOrigin}/v1/auth/callback/google`);
    // The OAuth state cookie, set on the web origin through the proxy.
    expect(response.headers['set-cookie']).toBeDefined();
  });

  it('refuses to redirect to another site after sign-in', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/v1/auth/sign-in/social',
      headers: json,
      payload: JSON.stringify({ provider: 'google', callbackURL: 'https://evil.example/steal' }),
    });
    expect(response.statusCode).toBe(403);
  });

  it('rejects cookie-carrying requests from another origin (CSRF)', async () => {
    const user = await insertTestUser(database.db);
    const response = await app.inject({
      method: 'POST',
      url: '/v1/auth/update-user',
      headers: {
        ...json,
        origin: 'https://evil.example',
        cookie: await sessionCookie(app, user.id),
      },
      payload: JSON.stringify({ name: 'Hijacked' }),
    });
    expect(response.statusCode).toBe(403);
  });

  it('never lets a user change their own platform role', async () => {
    const user = await insertTestUser(database.db);
    const response = await app.inject({
      method: 'POST',
      url: '/v1/auth/update-user',
      headers: { ...json, cookie: await sessionCookie(app, user.id) },
      payload: JSON.stringify({ platformRole: 'super_admin' }),
    });

    expect(response.statusCode).toBeLessThan(500);
    expect(await roleOf(user.id)).toBe('user');
  });

  it('stays out of the OpenAPI spec', () => {
    const paths = Object.keys(app.swagger().paths ?? {});
    expect(paths.some((path) => path.startsWith('/v1/auth'))).toBe(false);
  });
});

// Better Auth's in-memory limiter is shared by every app in this file, so each test uses
// its own made-up client addresses (TEST-NET ranges, never real).
describe('rate limits', () => {
  const signIn = (target: App, remoteAddress: string, headers: Record<string, string> = {}) =>
    target.inject({
      method: 'POST',
      url: '/v1/auth/sign-in/social',
      remoteAddress,
      headers: { ...json, ...headers },
      payload: JSON.stringify({ provider: 'google' }),
    });

  it('allows 10 sign-in attempts a minute per client, then answers 429', async () => {
    for (let attempt = 1; attempt <= 10; attempt++) {
      expect((await signIn(app, '192.0.2.10')).statusCode).toBe(200);
    }
    expect((await signIn(app, '192.0.2.10')).statusCode).toBe(429);
    // Another client is unaffected.
    expect((await signIn(app, '192.0.2.11')).statusCode).toBe(200);
  });

  it('ignores a forged X-Forwarded-For when no proxy is trusted', async () => {
    for (let attempt = 1; attempt <= 10; attempt++) {
      await signIn(app, '192.0.2.20', { 'x-forwarded-for': `198.51.100.${String(attempt)}` });
    }
    // Still the same socket address, whatever the header claims.
    expect(
      (await signIn(app, '192.0.2.20', { 'x-forwarded-for': '198.51.100.99' })).statusCode,
    ).toBe(429);
  });

  describe('behind a trusted proxy (TRUST_PROXY_HOPS=1)', () => {
    let proxied: App;
    const proxy = '192.0.2.30';

    beforeAll(async () => {
      proxied = await buildApp({
        env: testEnv({ BETTER_AUTH_URL: webOrigin, TRUST_PROXY_HOPS: '1' }),
      });
    });

    afterAll(async () => {
      await proxied.close();
    });

    it('limits each forwarded client on its own, not the proxy as a whole', async () => {
      const client = { 'x-forwarded-for': '198.51.100.40' };
      for (let attempt = 1; attempt <= 10; attempt++) {
        expect((await signIn(proxied, proxy, client)).statusCode).toBe(200);
      }
      expect((await signIn(proxied, proxy, client)).statusCode).toBe(429);
      expect(
        (await signIn(proxied, proxy, { 'x-forwarded-for': '198.51.100.41' })).statusCode,
      ).toBe(200);
    });
  });
});

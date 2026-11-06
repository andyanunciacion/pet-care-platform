import { createDatabase } from '@paw/db';
import { insertTestUser, testDatabaseUrl } from '@paw/db/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../../app.ts';
import { sessionCookie, testEnv } from '../../testing.ts';

let app: Awaited<ReturnType<typeof buildApp>>;
const database = createDatabase({ connectionString: testDatabaseUrl() });

beforeAll(async () => {
  app = await buildApp({ env: testEnv() });
});

afterAll(async () => {
  await app.close();
  await database.close();
});

const getMe = (cookie?: string) =>
  app.inject({
    method: 'GET',
    url: '/v1/admin/me',
    headers: cookie === undefined ? {} : { cookie },
  });

describe('/v1/admin/* (super admins only)', () => {
  it('401 when signed out', async () => {
    const response = await getMe();
    expect(response.statusCode).toBe(401);
    expect(response.headers['content-type']).toMatch(/^application\/problem\+json/);
    expect(response.json()).toMatchObject({ status: 401, title: 'Unauthorized' });
  });

  it('401 with a forged or unknown session cookie', async () => {
    const user = await insertTestUser(database.db);
    const valid = await sessionCookie(app, user.id);
    const [name] = valid.split('=');

    expect((await getMe(`${String(name)}=made-up-token.bad-signature`)).statusCode).toBe(401);
  });

  it('403 for a signed-in user who is not a super admin', async () => {
    const user = await insertTestUser(database.db);
    const response = await getMe(await sessionCookie(app, user.id));

    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({ status: 403, title: 'Forbidden' });
  });

  it('200 with the user for a super admin', async () => {
    const admin = await insertTestUser(database.db, { platformRole: 'super_admin' });
    const response = await getMe(await sessionCookie(app, admin.id));

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      id: admin.id,
      name: admin.name,
      email: admin.email,
      platformRole: 'super_admin',
    });
  });

  it('401 once the session is signed out', async () => {
    const admin = await insertTestUser(database.db, { platformRole: 'super_admin' });
    const cookie = await sessionCookie(app, admin.id);

    const signOut = await app.inject({
      method: 'POST',
      url: '/v1/auth/sign-out',
      headers: { cookie, origin: 'http://localhost:3000', 'content-type': 'application/json' },
      payload: '{}',
    });
    expect(signOut.statusCode).toBe(200);

    expect((await getMe(cookie)).statusCode).toBe(401);
  });

  it('is documented in the OpenAPI spec', () => {
    expect(app.swagger().paths?.['/v1/admin/me']?.get?.responses).toHaveProperty('200');
  });
});

describe('every /v1/admin route', () => {
  // Every admin route in the spec, e.g. ["PATCH", "/v1/admin/branches/<uuid>"]. A route
  // registered outside the admin plugin (and so unguarded) would fail these tests.
  const adminRoutes = () =>
    Object.entries(app.swagger().paths ?? {})
      .filter(([path]) => path.startsWith('/v1/admin/'))
      .flatMap(([path, item]) =>
        ['get', 'post', 'patch', 'put', 'delete']
          .filter((method) => item !== undefined && method in item)
          .map((method) => ({
            method: method.toUpperCase() as 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE',
            url: path.replace(/\{[^}]+\}/g, crypto.randomUUID()),
          })),
      );

  const call = (route: ReturnType<typeof adminRoutes>[number], cookie?: string) =>
    app.inject({
      ...route,
      headers: {
        ...(cookie !== undefined && { cookie }),
        ...(route.method !== 'GET' && { 'content-type': 'application/json' }),
      },
      ...(route.method !== 'GET' && { payload: '{}' }),
    });

  it('covers the routes this test expects to find', () => {
    expect(adminRoutes().length).toBeGreaterThanOrEqual(8);
  });

  it('answers 401 when signed out, before validating the request', async () => {
    for (const route of adminRoutes()) {
      expect({ ...route, status: (await call(route)).statusCode }).toEqual({
        ...route,
        status: 401,
      });
    }
  });

  it('answers 403 for a signed-in user who is not a super admin', async () => {
    const user = await insertTestUser(database.db);
    const cookie = await sessionCookie(app, user.id);
    for (const route of adminRoutes()) {
      expect({ ...route, status: (await call(route, cookie)).statusCode }).toEqual({
        ...route,
        status: 403,
      });
    }
  });
});

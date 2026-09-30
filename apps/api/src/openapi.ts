import { buildApp } from './app.ts';
import { parseEnv } from './env.ts';

/**
 * The API's OpenAPI document, built from the routes' Zod schemas without starting
 * the server or touching the database. packages/api-client generates its types from it.
 */
export async function openApiDocument(): Promise<Record<string, unknown>> {
  const app = await buildApp({
    env: parseEnv({
      NODE_ENV: 'test',
      LOG_LEVEL: 'silent',
      // The connection pool is lazy: nothing connects unless a query runs.
      DATABASE_URL: 'postgres://unused@localhost:5432/unused',
    }),
  });
  try {
    await app.ready();
    return app.swagger() as unknown as Record<string, unknown>;
  } finally {
    await app.close();
  }
}

import type { TestProject } from 'vitest/node';
import './context.ts';
import { createTestDatabase } from './test-database.ts';

/** Local Docker database (docker-compose.yml). CI points DATABASE_URL at its own. */
const LOCAL_DATABASE_URL = 'postgres://paw:paw@localhost:5432/paw';

/**
 * Vitest global setup: runs once per test run of a package that lists it in
 * vitest.config.ts. Creates a fresh, migrated database, and drops it afterwards.
 * Tests get its URL with testDatabaseUrl() from "@paw/db/testing".
 */
export default async function setup(project: TestProject): Promise<() => Promise<void>> {
  const adminUrl = process.env.DATABASE_URL ?? LOCAL_DATABASE_URL;
  let database;
  try {
    database = await createTestDatabase(adminUrl);
  } catch (error) {
    const { host } = new URL(adminUrl);
    throw new Error(
      `Could not create a test database on ${host}. Is Postgres running? (docker compose up -d)`,
      { cause: error },
    );
  }
  project.provide('databaseUrl', database.url);
  return () => database.drop();
}

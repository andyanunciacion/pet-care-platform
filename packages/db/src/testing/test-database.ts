import { randomBytes } from 'node:crypto';
import pg from 'pg';
import { runMigrations } from '../migrate.ts';

export interface TestDatabase {
  url: string;
  drop(): Promise<void>;
}

async function runAsAdmin(adminUrl: string, statement: string): Promise<void> {
  const client = new pg.Client({ connectionString: adminUrl });
  await client.connect();
  try {
    await client.query(statement);
  } finally {
    await client.end();
  }
}

/**
 * Creates an empty database next to the one in `adminUrl` and applies all migrations.
 * New databases are copied from Postgres's clean "template1", so tests see exactly
 * what the migrations create, like production, not the extras the Docker image adds.
 */
export async function createTestDatabase(adminUrl: string): Promise<TestDatabase> {
  const name = `paw_test_${Date.now()}_${randomBytes(3).toString('hex')}`;
  const url = new URL(adminUrl);
  url.pathname = `/${name}`;

  const drop = () =>
    // FORCE closes connections a test forgot to close, so cleanup never gets stuck.
    runAsAdmin(adminUrl, `DROP DATABASE IF EXISTS ${pg.escapeIdentifier(name)} WITH (FORCE)`);

  await runAsAdmin(adminUrl, `CREATE DATABASE ${pg.escapeIdentifier(name)}`);
  try {
    await runMigrations(url.toString());
  } catch (error) {
    await drop();
    throw error;
  }
  return { url: url.toString(), drop };
}

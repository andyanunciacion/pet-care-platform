import path from 'node:path';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import pg from 'pg';

const MIGRATIONS_FOLDER = path.join(import.meta.dirname, '..', 'migrations');

/**
 * Applies every migration in packages/db/migrations that hasn't run yet, in order.
 * Drizzle records applied ones in the drizzle.__drizzle_migrations table, so this is
 * safe to run on every deploy.
 */
export async function runMigrations(connectionString: string): Promise<void> {
  const pool = new pg.Pool({ connectionString, max: 1 });
  try {
    await migrate(drizzle({ client: pool }), { migrationsFolder: MIGRATIONS_FOLDER });
  } finally {
    await pool.end();
  }
}

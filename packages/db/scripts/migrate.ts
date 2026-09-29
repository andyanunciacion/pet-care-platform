// `pnpm db:migrate`: applies pending migrations to the database in DATABASE_URL.
import { runMigrations } from '../src/migrate.ts';
import { databaseUrlFromEnv } from '../src/url.ts';

try {
  await runMigrations(databaseUrlFromEnv());
  console.log('Migrations applied.');
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}

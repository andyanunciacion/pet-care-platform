import { existsSync } from 'node:fs';
import { defineConfig } from 'drizzle-kit';

// drizzle-kit doesn't read .env itself; `db:studio` needs DATABASE_URL (`db:generate` doesn't).
if (existsSync('.env')) process.loadEnvFile('.env');
const url = process.env.DATABASE_URL;

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/schema/index.ts',
  out: './migrations',
  // Must match createDatabase(): camelCase fields in TypeScript, snake_case columns in SQL.
  casing: 'snake_case',
  // PostGIS owns some tables (spatial_ref_sys); drizzle-kit must leave them alone.
  extensionsFilters: ['postgis'],
  ...(url !== undefined && { dbCredentials: { url } }),
});

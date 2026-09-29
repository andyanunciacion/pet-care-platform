import { z } from 'zod';

/** A Postgres connection URL, e.g. postgres://user:password@host:5432/database. */
export const DatabaseUrlSchema = z.url({ protocol: /^postgres(ql)?$/ });

/** Reads DATABASE_URL for scripts; the error names the variable but never echoes its value. */
export function databaseUrlFromEnv(env: Record<string, string | undefined> = process.env): string {
  const result = DatabaseUrlSchema.safeParse(env.DATABASE_URL);
  if (!result.success) {
    throw new Error('DATABASE_URL is missing or not a postgres:// URL (see .env.example).');
  }
  return result.data;
}

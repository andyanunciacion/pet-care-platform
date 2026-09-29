import { DatabaseUrlSchema } from '@paw/db';
import { z } from 'zod';

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  // Hosting platforms need 0.0.0.0; locally we only listen on this machine.
  HOST: z.string().min(1).default('127.0.0.1'),
  PORT: z.coerce.number().int().min(1).max(65_535).default(4000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  DATABASE_URL: DatabaseUrlSchema,
  // Comma-separated browser origins allowed to call the API (the web app).
  CORS_ORIGINS: z
    .string()
    .default('http://localhost:3000')
    .transform((value) =>
      value
        .split(',')
        .map((origin) => origin.trim())
        .filter((origin) => origin !== ''),
    )
    .pipe(z.array(z.url()).min(1)),
});

export type Env = z.output<typeof EnvSchema>;

/**
 * Validates environment variables. Throws a readable list of problems if any are
 * missing or invalid, so the server refuses to boot instead of failing later.
 * The message names the variables but never echoes their values (they may be secrets).
 */
export function parseEnv(source: Record<string, string | undefined>): Env {
  const result = EnvSchema.safeParse(source);
  if (!result.success) {
    throw new Error(`Invalid environment variables:\n${z.prettifyError(result.error)}`);
  }
  return result.data;
}

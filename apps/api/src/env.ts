import { DatabaseUrlSchema } from '@paw/db';
import { z } from 'zod';

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  // Hosting platforms need 0.0.0.0; locally we only listen on this machine.
  HOST: z.string().min(1).default('127.0.0.1'),
  PORT: z.coerce.number().int().min(1).max(65_535).default(4000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  // How many proxies in front of the API append to X-Forwarded-For (Fastify `trustProxy`),
  // so request.ip is the real client and not a proxy. 0 = use the socket address (local).
  // Set per environment after checking the real chain (staging: Vercel → Railway edge).
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(5).default(0),
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
  // Signs session cookies. Generate with `openssl rand -base64 32`; rotating it signs everyone out.
  BETTER_AUTH_SECRET: z.string().min(32, 'must be at least 32 characters'),
  // The public origin users sign in on: the WEB app, which proxies /v1/* to this API
  // (ARCHITECTURE D31). Google's redirect URI is this + /v1/auth/callback/google.
  BETTER_AUTH_URL: z.url().default('http://localhost:3000'),
  // OAuth client from Google Cloud Console (APIs & Services → Credentials).
  GOOGLE_CLIENT_ID: z.string().min(1),
  GOOGLE_CLIENT_SECRET: z.string().min(1),
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

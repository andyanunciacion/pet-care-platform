import { DatabaseUrlSchema } from '@paw/db';
import { z } from 'zod';

/** An optional variable where `NAME=` (empty, as in a copied .env.example) means unset. */
const unsetIfEmpty = <T extends z.ZodType>(schema: T) =>
  z.preprocess((value) => (value === '' ? undefined : value), schema.optional());

const R2_VARS = [
  'R2_ACCOUNT_ID',
  'R2_ACCESS_KEY_ID',
  'R2_SECRET_ACCESS_KEY',
  'R2_BUCKET',
  'R2_PUBLIC_URL',
] as const;

const EnvSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    // Hosting platforms need 0.0.0.0; locally we only listen on this machine.
    HOST: z.string().min(1).default('127.0.0.1'),
    PORT: z.coerce.number().int().min(1).max(65_535).default(4000),
    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
      .default('info'),
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
    // Photo storage: a Cloudflare R2 bucket (ARCHITECTURE D38). Optional: without it the API
    // runs and the photo routes answer 503. Set all five or none.
    R2_ACCOUNT_ID: unsetIfEmpty(z.string()),
    R2_ACCESS_KEY_ID: unsetIfEmpty(z.string()),
    R2_SECRET_ACCESS_KEY: unsetIfEmpty(z.string()),
    R2_BUCKET: unsetIfEmpty(z.string()),
    // Where the bucket's objects are public, e.g. https://pub-….r2.dev (no trailing slash).
    R2_PUBLIC_URL: unsetIfEmpty(
      z.url({ protocol: /^https?$/ }).transform((url) => url.replace(/\/+$/, '')),
    ),
  })
  .superRefine((env, ctx) => {
    const set = R2_VARS.filter((name) => env[name] !== undefined);
    if (set.length > 0 && set.length < R2_VARS.length) {
      for (const name of R2_VARS.filter((n) => env[n] === undefined)) {
        ctx.addIssue({
          code: 'custom',
          path: [name],
          message: 'set all R2_* variables, or none (photo uploads then stay off)',
        });
      }
    }
  });

export type Env = z.output<typeof EnvSchema>;

export interface R2Config {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  publicUrl: string;
}

/** The R2 settings, or null when photo storage isn't configured. */
export function r2Config(env: Env): R2Config | null {
  const {
    R2_ACCOUNT_ID: accountId,
    R2_ACCESS_KEY_ID: accessKeyId,
    R2_SECRET_ACCESS_KEY: secretAccessKey,
    R2_BUCKET: bucket,
    R2_PUBLIC_URL: publicUrl,
  } = env;
  if (
    accountId === undefined ||
    accessKeyId === undefined ||
    secretAccessKey === undefined ||
    bucket === undefined ||
    publicUrl === undefined
  ) {
    return null;
  }
  return { accountId, accessKeyId, secretAccessKey, bucket, publicUrl };
}

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

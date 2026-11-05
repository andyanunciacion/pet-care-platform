import type { Database } from '@paw/db';
import { schema } from '@paw/db';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import type { FastifyBaseLogger } from 'fastify';
import type { Env } from './env.ts';

/** Where Better Auth's routes live: /v1/auth/sign-in/social, /v1/auth/callback/google, … */
export const AUTH_BASE_PATH = '/v1/auth';

/**
 * The header the auth route sets to the client IP Fastify resolved (see TRUST_PROXY_HOPS),
 * replacing anything the client sent. Better Auth reads only this header, so its rate
 * limiter and session records can't be fooled by a forged X-Forwarded-For.
 */
export const CLIENT_IP_HEADER = 'x-paw-client-ip';

export const PLATFORM_ROLES = ['user', 'super_admin'] as const;
export type PlatformRole = (typeof PLATFORM_ROLES)[number];

interface AuthOptions {
  env: Env;
  database: Database;
  log: FastifyBaseLogger;
}

/** Better Auth (ARCHITECTURE §7, D10): sessions, Google sign-in, rate limits. */
export function createAuth({ env, database, log }: AuthOptions) {
  return betterAuth({
    appName: 'PAW',
    // The web origin, not the API's: browsers reach these routes through the web app's
    // /v1/* rewrite, so cookies and redirects belong to the site users are on (D31).
    baseURL: env.BETTER_AUTH_URL,
    basePath: AUTH_BASE_PATH,
    secret: env.BETTER_AUTH_SECRET,
    database: drizzleAdapter(database.db, {
      provider: 'pg',
      schema: {
        user: schema.user,
        session: schema.session,
        account: schema.account,
        verification: schema.verification,
      },
      transaction: true,
    }),
    advanced: {
      // Ids are UUID v7 from the database default (D23); Better Auth leaves them to Postgres.
      database: { generateId: 'uuid' },
      ipAddress: { ipAddressHeaders: [CLIENT_IP_HEADER] },
      // Origin/CSRF checks on, explicitly: Better Auth turns them off when NODE_ENV=test,
      // and the tests should prove the protection production has.
      disableOriginCheck: false,
    },
    socialProviders: {
      google: {
        clientId: env.GOOGLE_CLIENT_ID,
        clientSecret: env.GOOGLE_CLIENT_SECRET,
        // Always show the account chooser, so signing in as a different account is easy.
        prompt: 'select_account',
      },
    },
    user: {
      additionalFields: {
        platformRole: {
          type: [...PLATFORM_ROLES],
          defaultValue: 'user',
          // Never settable through any auth endpoint; only promote-admin changes it.
          input: false,
        },
      },
    },
    rateLimit: {
      // On in every environment (Better Auth's default is production only), so tests cover it.
      enabled: true,
      // In memory: fine for one API instance (D32). Resets on deploy.
      storage: 'memory',
      window: 60,
      max: 100,
      customRules: {
        '/sign-in/*': { window: 60, max: 10 },
        '/callback/*': { window: 60, max: 10 },
      },
    },
    telemetry: { enabled: false },
    // Into our pino logger, message only: Better Auth's extra arguments can include
    // request data (emails, tokens), and personal data never goes in logs.
    logger: {
      log(level, message) {
        log[level]({ source: 'better-auth' }, message);
      },
    },
  });
}

export type Auth = ReturnType<typeof createAuth>;

import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import Fastify from 'fastify';
import {
  jsonSchemaTransform,
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod';
import { createDatabase } from '@paw/db';
import { createAuth } from './auth.ts';
import { r2Config, type Env } from './env.ts';
import { errorHandler, notFoundHandler } from './errors.ts';
import { loggerOptions } from './logger.ts';
import { adminRoutes } from './routes/admin/index.ts';
import { authRoutes } from './routes/auth.ts';
import { publicRoutes } from './routes/public/index.ts';
import { healthRoutes } from './routes/health.ts';
import { createR2Storage, type PhotoStorage } from './storage.ts';

export interface AppOptions {
  env: Env;
  /**
   * Photo storage. Defaults to the R2 bucket in env, or none (the media routes answer 503).
   * Tests pass an in-memory one (createMemoryStorage).
   */
  storage?: PhotoStorage | null;
}

/**
 * Builds the Fastify app without starting to listen, so tests can call it
 * in-process with `app.inject()` (no network, no port).
 */
export async function buildApp({ env, storage: storageOption }: AppOptions) {
  const r2 = r2Config(env);
  const storage =
    storageOption !== undefined ? storageOption : r2 === null ? null : createR2Storage(r2);

  const app = Fastify({
    logger: loggerOptions(env),
    // request.ip = the client: trust the nearest TRUST_PROXY_HOPS proxies in
    // X-Forwarded-For (hop 0 = the socket peer). 0 = never trust the header.
    trustProxy: (_address, hop) => hop < env.TRUST_PROXY_HOPS,
  }).withTypeProvider<ZodTypeProvider>();

  // Zod schemas on routes validate requests and serialize responses.
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  app.setErrorHandler(errorHandler);
  app.setNotFoundHandler(notFoundHandler);

  const database = createDatabase({
    connectionString: env.DATABASE_URL,
    onIdleError: (error) => {
      app.log.error({ err: error }, 'idle database connection failed');
    },
  });
  app.addHook('onClose', () => database.close());

  // Root-level decorations, so every plugin and hook can reach them.
  app.decorate('auth', createAuth({ env, database, log: app.log }));
  app.decorateRequest('sessionUser', null);

  await app.register(helmet, {
    // The API only returns JSON, so a Content-Security-Policy protects nothing, except
    // that it would block the dev docs page's scripts. Keep it everywhere but development.
    contentSecurityPolicy: env.NODE_ENV !== 'development',
  });
  await app.register(cors, { origin: env.CORS_ORIGINS });

  // Builds the OpenAPI spec from the routes' Zod schemas (feeds the typed client in P0-T4).
  await app.register(swagger, {
    openapi: { info: { title: 'PAW API', version: '0.0.0' } },
    transform: jsonSchemaTransform,
  });
  if (env.NODE_ENV === 'development') {
    await app.register(swaggerUi, { routePrefix: '/docs' });
  }

  await app.register(healthRoutes, { database });
  await app.register(authRoutes, { auth: app.auth, publicOrigin: env.BETTER_AUTH_URL });
  await app.register(adminRoutes, { prefix: '/v1/admin', database, storage });
  await app.register(publicRoutes, { prefix: '/v1', database });

  return app;
}

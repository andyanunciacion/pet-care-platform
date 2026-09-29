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
import type { Env } from './env.ts';
import { errorHandler, notFoundHandler } from './errors.ts';
import { loggerOptions } from './logger.ts';
import { healthRoutes } from './routes/health.ts';

export interface AppOptions {
  env: Env;
}

/**
 * Builds the Fastify app without starting to listen, so tests can call it
 * in-process with `app.inject()` (no network, no port).
 */
export async function buildApp({ env }: AppOptions) {
  const app = Fastify({ logger: loggerOptions(env) }).withTypeProvider<ZodTypeProvider>();

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

  return app;
}

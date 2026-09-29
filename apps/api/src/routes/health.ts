import type { Database } from '@paw/db';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';

const HealthSchema = z.object({
  status: z.enum(['ok', 'error']),
  checks: z.object({ database: z.enum(['ok', 'error']) }),
});

/** Used by uptime monitoring and deploys: 200 when the API and database are up, 503 otherwise. */
export const healthRoutes: FastifyPluginAsyncZod<{ database: Database }> = async (
  app,
  { database },
) => {
  app.get(
    '/health',
    {
      schema: {
        summary: 'API and database status',
        tags: ['ops'],
        response: { 200: HealthSchema, 503: HealthSchema },
      },
    },
    async (request, reply) => {
      try {
        await database.ping();
        return { status: 'ok', checks: { database: 'ok' } } as const;
      } catch (error) {
        request.log.warn({ err: error }, 'health check: database unreachable');
        return reply.status(503).send({ status: 'error', checks: { database: 'error' } });
      }
    },
  );
};

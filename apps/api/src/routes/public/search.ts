import type { Database } from '@paw/db';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import {
  recordSearch,
  search,
  SearchQuerySchema,
  SearchResponseSchema,
} from '../../services/search.ts';

/** Search for owners: clinics and services by text, place, species, open now, emergency (ARCHITECTURE §6). */
export const publicSearchRoutes: FastifyPluginAsyncZod<{ database: Database }> = async (
  app,
  { database: { db } },
) => {
  app.get(
    '/search',
    {
      schema: {
        summary: 'Search published branches and their services',
        tags: ['public'],
        querystring: SearchQuerySchema,
        response: { 200: SearchResponseSchema },
      },
    },
    async (request) => {
      const { response, log } = await search(db, request.query, new Date());
      if (log !== null) {
        // The log feeds ops stats; losing a row must never fail the search.
        await recordSearch(db, log).catch((error: unknown) => {
          request.log.warn({ err: error }, 'search log write failed');
        });
      }
      return response;
    },
  );
};

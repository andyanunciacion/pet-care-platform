import type { Database } from '@paw/db';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { getListing, ListingParamsSchema, ListingSchema } from '../../services/listings.ts';

/** The clinic page's data (DESIGN UX8). */
export const publicListingRoutes: FastifyPluginAsyncZod<{ database: Database }> = async (
  app,
  { database: { db } },
) => {
  app.get(
    '/listings/:businessSlug',
    {
      schema: {
        summary: 'A published business and its public branches (the clinic page)',
        tags: ['public'],
        params: ListingParamsSchema,
        response: { 200: ListingSchema },
      },
    },
    (request) => getListing(db, request.params.businessSlug),
  );
};

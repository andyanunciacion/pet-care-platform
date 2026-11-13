import type { Database } from '@paw/db';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { getListing, ListingParamsSchema, ListingSchema } from '../../services/listings.ts';
import type { PhotoStorage } from '../../storage.ts';

/** The clinic page's data (DESIGN UX8). */
export const publicListingRoutes: FastifyPluginAsyncZod<{
  database: Database;
  storage: PhotoStorage | null;
}> = async (app, { database: { db }, storage }) => {
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
    (request) => getListing(db, storage, request.params.businessSlug),
  );
};

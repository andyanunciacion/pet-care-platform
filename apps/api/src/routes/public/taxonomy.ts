import type { Database } from '@paw/db';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { getTaxonomy, TaxonomySchema } from '../../services/taxonomy.ts';

/** Species and service categories, for the search filters. Their codes are what /search takes. */
export const publicTaxonomyRoutes: FastifyPluginAsyncZod<{ database: Database }> = async (
  app,
  { database: { db } },
) => {
  app.get(
    '/taxonomy',
    {
      schema: {
        summary: 'Species and service categories (search filters)',
        tags: ['public'],
        response: { 200: TaxonomySchema },
      },
    },
    () => getTaxonomy(db),
  );
};

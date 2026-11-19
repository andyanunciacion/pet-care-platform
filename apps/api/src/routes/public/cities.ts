import type { Database } from '@paw/db';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { CitiesSchema, listCities } from '../../services/cities.ts';

/** The cities with published listings, for the search page's city picker (DESIGN UX1). */
export const publicCityRoutes: FastifyPluginAsyncZod<{ database: Database }> = async (
  app,
  { database: { db } },
) => {
  app.get(
    '/cities',
    {
      schema: {
        summary: 'Cities and municipalities with published listings',
        tags: ['public'],
        response: { 200: CitiesSchema },
      },
    },
    () => listCities(db),
  );
};

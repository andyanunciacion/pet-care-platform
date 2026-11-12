import type { Database } from '@paw/db';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { publicListingRoutes } from './listings.ts';

/**
 * Public routes (/v1/*) for the owner-facing site: read-only, no session needed. Anything
 * that needs a signed-in user belongs in the admin plugin (or, from slice 8, the clinic
 * dashboard's), never here.
 */
export const publicRoutes: FastifyPluginAsyncZod<{ database: Database }> = async (
  app,
  { database },
) => {
  await app.register(publicListingRoutes, { database });
};

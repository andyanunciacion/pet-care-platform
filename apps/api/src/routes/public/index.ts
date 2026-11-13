import type { Database } from '@paw/db';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import type { PhotoStorage } from '../../storage.ts';
import { publicListingRoutes } from './listings.ts';

/**
 * Public routes (/v1/*) for the owner-facing site: read-only, no session needed. Anything
 * that needs a signed-in user belongs in the admin plugin (or, from slice 8, the clinic
 * dashboard's), never here.
 */
export const publicRoutes: FastifyPluginAsyncZod<{
  database: Database;
  /** Only for image URLs; null when it isn't configured (listings then have no images). */
  storage: PhotoStorage | null;
}> = async (app, { database, storage }) => {
  await app.register(publicListingRoutes, { database, storage });
};

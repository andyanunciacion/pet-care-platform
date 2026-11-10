import type { Database } from '@paw/db';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { sessionUserOf } from '../../authz.ts';
import { ImportCsvSchema, ImportResultSchema, importListings } from '../../services/imports.ts';

/**
 * CSV import of listings (ARCHITECTURE D39). The CSV can be up to 500 KB, which JSON escaping
 * can push past Fastify's default 1 MiB body limit, so this route allows 2 MiB.
 * Registered inside the admin plugin.
 */
export const adminImportRoutes: FastifyPluginAsyncZod<{ database: Database }> = async (
  app,
  { database: { db } },
) => {
  app.post(
    '/imports',
    {
      bodyLimit: 2 * 1024 * 1024,
      schema: {
        summary:
          'Check a CSV of listings (dryRun: true), or import the businesses that pass (dryRun: false)',
        tags: ['admin'],
        body: ImportCsvSchema,
        response: { 200: ImportResultSchema },
      },
    },
    (request) => importListings(db, sessionUserOf(request).id, request.body, new Date()),
  );
};

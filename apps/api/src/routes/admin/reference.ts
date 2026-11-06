import type { Database } from '@paw/db';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import {
  AuditLogPageSchema,
  ListAuditLogQuerySchema,
  listAuditLog,
} from '../../services/audit-log.ts';
import { AreaListSchema, ListAreasQuerySchema, listAreas } from '../../services/psgc-areas.ts';

/** Read-only lookups for the admin: PSGC areas (address pickers) and the audit log. */
export const adminReferenceRoutes: FastifyPluginAsyncZod<{ database: Database }> = async (
  app,
  { database: { db } },
) => {
  app.get(
    '/psgc-areas',
    {
      schema: {
        summary: 'PSGC areas under a parent (provinces when no parent is given)',
        tags: ['admin'],
        querystring: ListAreasQuerySchema,
        response: { 200: AreaListSchema },
      },
    },
    (request) => listAreas(db, request.query),
  );

  app.get(
    '/audit-log',
    {
      schema: {
        summary: 'Audit log entries, newest first',
        tags: ['admin'],
        querystring: ListAuditLogQuerySchema,
        response: { 200: AuditLogPageSchema },
      },
    },
    (request) => listAuditLog(db, request.query),
  );
};

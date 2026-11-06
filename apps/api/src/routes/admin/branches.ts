import type { Database } from '@paw/db';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { sessionUserOf } from '../../authz.ts';
import {
  BranchSchema,
  UpdateBranchSchema,
  getBranch,
  updateBranch,
} from '../../services/branches.ts';

const IdParamsSchema = z.object({ id: z.uuid() });

/** One branch: address, map pin, contacts, flags. Registered inside the admin plugin. */
export const adminBranchRoutes: FastifyPluginAsyncZod<{ database: Database }> = async (
  app,
  { database: { db } },
) => {
  app.get(
    '/branches/:id',
    {
      schema: {
        summary: 'A branch with its contacts and address areas',
        tags: ['admin'],
        params: IdParamsSchema,
        response: { 200: BranchSchema },
      },
    },
    (request) => getBranch(db, request.params.id),
  );

  app.patch(
    '/branches/:id',
    {
      schema: {
        summary: 'Edit a branch (only the fields sent change; contacts replace the list)',
        tags: ['admin'],
        params: IdParamsSchema,
        body: UpdateBranchSchema,
        response: { 200: BranchSchema },
      },
    },
    (request) => updateBranch(db, sessionUserOf(request).id, request.params.id, request.body),
  );
};

import type { Database } from '@paw/db';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { sessionUserOf } from '../../authz.ts';
import {
  BranchServicesSchema,
  CopyServiceResultSchema,
  CopyServiceSchema,
  CreateServiceSchema,
  ServiceSchema,
  SetSpeciesTreatedSchema,
  UpdateServiceSchema,
  copyServiceToBranches,
  createService,
  deleteService,
  getBranchServices,
  setSpeciesTreated,
  updateService,
} from '../../services/branch-services.ts';

const IdParamsSchema = z.object({ id: z.uuid() });

/**
 * A branch's services and prices, and the species it treats (ARCHITECTURE D36, D37).
 * Registered inside the admin plugin.
 */
export const adminBranchServiceRoutes: FastifyPluginAsyncZod<{ database: Database }> = async (
  app,
  { database: { db } },
) => {
  app.get(
    '/branches/:id/services',
    {
      schema: {
        summary: "A branch's services, the species it treats and the business's other branches",
        tags: ['admin'],
        params: IdParamsSchema,
        response: { 200: BranchServicesSchema },
      },
    },
    (request) => getBranchServices(db, request.params.id),
  );

  app.put(
    '/branches/:id/species',
    {
      schema: {
        summary: 'Replace the species a branch treats',
        tags: ['admin'],
        params: IdParamsSchema,
        body: SetSpeciesTreatedSchema,
        response: { 200: BranchServicesSchema },
      },
    },
    (request) => setSpeciesTreated(db, sessionUserOf(request).id, request.params.id, request.body),
  );

  app.post(
    '/branches/:id/services',
    {
      schema: {
        summary: 'Add a service to a branch',
        tags: ['admin'],
        params: IdParamsSchema,
        body: CreateServiceSchema,
        response: { 201: ServiceSchema },
      },
    },
    async (request, reply) =>
      reply
        .status(201)
        .send(await createService(db, sessionUserOf(request).id, request.params.id, request.body)),
  );

  app.patch(
    '/services/:id',
    {
      schema: {
        summary: 'Edit a service (only the fields sent change; speciesIds replaces the list)',
        tags: ['admin'],
        params: IdParamsSchema,
        body: UpdateServiceSchema,
        response: { 200: ServiceSchema },
      },
    },
    (request) => updateService(db, sessionUserOf(request).id, request.params.id, request.body),
  );

  app.delete(
    '/services/:id',
    {
      schema: {
        summary: 'Remove a service',
        tags: ['admin'],
        params: IdParamsSchema,
        response: { 204: z.null() },
      },
    },
    async (request, reply) => {
      await deleteService(db, sessionUserOf(request).id, request.params.id);
      // 204 No Content: Fastify sends no body, whatever is passed here.
      return reply.status(204).send(null);
    },
  );

  app.post(
    '/services/:id/copy-to-branches',
    {
      schema: {
        summary:
          "Copy a service to the business's other branches, overwriting a same-named one in the same category",
        tags: ['admin'],
        params: IdParamsSchema,
        body: CopyServiceSchema,
        response: { 200: CopyServiceResultSchema },
      },
    },
    (request) =>
      copyServiceToBranches(db, sessionUserOf(request).id, request.params.id, request.body),
  );
};

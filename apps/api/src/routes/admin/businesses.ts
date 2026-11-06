import type { Database } from '@paw/db';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { sessionUserOf } from '../../authz.ts';
import { BranchSchema, CreateBranchSchema, createBranch } from '../../services/branches.ts';
import {
  BusinessDetailSchema,
  BusinessListSchema,
  BusinessSchema,
  CreateBusinessSchema,
  ListBusinessesQuerySchema,
  UpdateBusinessSchema,
  createBusiness,
  getBusiness,
  listBusinesses,
  updateBusiness,
} from '../../services/businesses.ts';

const IdParamsSchema = z.object({ id: z.uuid() });

/** Listings: businesses and the branches under them. Registered inside the admin plugin. */
export const adminBusinessRoutes: FastifyPluginAsyncZod<{ database: Database }> = async (
  app,
  { database: { db } },
) => {
  app.get(
    '/businesses',
    {
      schema: {
        summary: 'Search and filter businesses (the listings table)',
        tags: ['admin'],
        querystring: ListBusinessesQuerySchema,
        response: { 200: BusinessListSchema },
      },
    },
    (request) => listBusinesses(db, request.query),
  );

  app.post(
    '/businesses',
    {
      schema: {
        summary: 'Create a business (starts hidden)',
        tags: ['admin'],
        body: CreateBusinessSchema,
        response: { 201: BusinessSchema },
      },
    },
    async (request, reply) =>
      reply.status(201).send(await createBusiness(db, sessionUserOf(request).id, request.body)),
  );

  app.get(
    '/businesses/:id',
    {
      schema: {
        summary: 'A business with its branches',
        tags: ['admin'],
        params: IdParamsSchema,
        response: { 200: BusinessDetailSchema },
      },
    },
    (request) => getBusiness(db, request.params.id),
  );

  app.patch(
    '/businesses/:id',
    {
      schema: {
        summary: 'Edit a business (only the fields sent change)',
        tags: ['admin'],
        params: IdParamsSchema,
        body: UpdateBusinessSchema,
        response: { 200: BusinessSchema },
      },
    },
    (request) => updateBusiness(db, sessionUserOf(request).id, request.params.id, request.body),
  );

  app.post(
    '/businesses/:id/branches',
    {
      schema: {
        summary: 'Add a branch to a business',
        tags: ['admin'],
        params: IdParamsSchema,
        body: CreateBranchSchema,
        response: { 201: BranchSchema },
      },
    },
    async (request, reply) =>
      reply
        .status(201)
        .send(await createBranch(db, sessionUserOf(request).id, request.params.id, request.body)),
  );
};

import type { Database } from '@paw/db';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { sessionUserOf } from '../../authz.ts';
import {
  CreateProductSchema,
  ProductListSchema,
  ProductSchema,
  UpdateProductSchema,
  createProduct,
  deleteProduct,
  listProducts,
  updateProduct,
} from '../../services/products.ts';

const IdParamsSchema = z.object({ id: z.uuid() });

/** A business's products (read-only on its page). Registered inside the admin plugin. */
export const adminProductRoutes: FastifyPluginAsyncZod<{ database: Database }> = async (
  app,
  { database: { db } },
) => {
  app.get(
    '/businesses/:id/products',
    {
      schema: {
        summary: "A business's products, by category then name",
        tags: ['admin'],
        params: IdParamsSchema,
        response: { 200: ProductListSchema },
      },
    },
    (request) => listProducts(db, request.params.id),
  );

  app.post(
    '/businesses/:id/products',
    {
      schema: {
        summary: 'Add a product to a business',
        tags: ['admin'],
        params: IdParamsSchema,
        body: CreateProductSchema,
        response: { 201: ProductSchema },
      },
    },
    async (request, reply) =>
      reply
        .status(201)
        .send(await createProduct(db, sessionUserOf(request).id, request.params.id, request.body)),
  );

  app.patch(
    '/products/:id',
    {
      schema: {
        summary: 'Edit a product (only the fields sent change)',
        tags: ['admin'],
        params: IdParamsSchema,
        body: UpdateProductSchema,
        response: { 200: ProductSchema },
      },
    },
    (request) => updateProduct(db, sessionUserOf(request).id, request.params.id, request.body),
  );

  app.delete(
    '/products/:id',
    {
      schema: {
        summary: 'Remove a product',
        tags: ['admin'],
        params: IdParamsSchema,
        response: { 204: z.null() },
      },
    },
    async (request, reply) => {
      await deleteProduct(db, sessionUserOf(request).id, request.params.id);
      // 204 No Content: Fastify sends no body, whatever is passed here.
      return reply.status(204).send(null);
    },
  );
};

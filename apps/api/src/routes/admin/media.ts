import type { Database } from '@paw/db';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { sessionUserOf } from '../../authz.ts';
import {
  BranchPhotosSchema,
  BusinessMediaSchema,
  CreateUploadSchema,
  FinalizeUploadSchema,
  MediaSchema,
  ReorderPhotosSchema,
  UpdateMediaSchema,
  UploadSchema,
  addBranchPhoto,
  createUpload,
  deleteMedia,
  getBusinessMedia,
  listBranchPhotos,
  reorderBranchPhotos,
  setBusinessLogo,
  setProductImage,
  storageOff,
  updateMediaAlt,
} from '../../services/media.ts';
import type { PhotoStorage } from '../../storage.ts';

const IdParamsSchema = z.object({ id: z.uuid() });

/**
 * Images (ARCHITECTURE D38): upload URLs, branch photos, the business logo and product
 * images. Without photo storage configured, every route answers 503. Registered inside the
 * admin plugin.
 */
export const adminMediaRoutes: FastifyPluginAsyncZod<{
  database: Database;
  storage: PhotoStorage | null;
}> = async (app, { database: { db }, storage: maybeStorage }) => {
  const storage = (): PhotoStorage => {
    if (maybeStorage === null) throw storageOff();
    return maybeStorage;
  };
  const tags = ['admin'];

  app.post(
    '/uploads',
    {
      schema: {
        summary: 'A presigned URL to upload one image to (then finalize it with its owner route)',
        tags,
        body: CreateUploadSchema,
        response: { 200: UploadSchema },
      },
    },
    (request) => createUpload(db, storage(), request.body),
  );

  app.get(
    '/branches/:id/photos',
    {
      schema: {
        summary: "A branch's photos, in display order",
        tags,
        params: IdParamsSchema,
        response: { 200: BranchPhotosSchema },
      },
    },
    (request) => listBranchPhotos(db, storage(), request.params.id),
  );

  app.post(
    '/branches/:id/photos',
    {
      schema: {
        summary: 'Add an uploaded photo to a branch (last in the order)',
        tags,
        params: IdParamsSchema,
        body: FinalizeUploadSchema,
        response: { 201: MediaSchema },
      },
    },
    async (request, reply) =>
      reply
        .status(201)
        .send(
          await addBranchPhoto(
            db,
            storage(),
            request.log,
            sessionUserOf(request).id,
            request.params.id,
            request.body,
          ),
        ),
  );

  app.put(
    '/branches/:id/photos/order',
    {
      schema: {
        summary: "Reorder a branch's photos (send every photo id, in the new order)",
        tags,
        params: IdParamsSchema,
        body: ReorderPhotosSchema,
        response: { 200: BranchPhotosSchema },
      },
    },
    (request) =>
      reorderBranchPhotos(
        db,
        storage(),
        sessionUserOf(request).id,
        request.params.id,
        request.body,
      ),
  );

  app.get(
    '/businesses/:id/media',
    {
      schema: {
        summary: "A business's logo and its products' images",
        tags,
        params: IdParamsSchema,
        response: { 200: BusinessMediaSchema },
      },
    },
    (request) => getBusinessMedia(db, storage(), request.params.id),
  );

  app.put(
    '/businesses/:id/logo',
    {
      schema: {
        summary: "Set a business's logo from an upload (replaces the current one)",
        tags,
        params: IdParamsSchema,
        body: FinalizeUploadSchema,
        response: { 200: MediaSchema },
      },
    },
    (request) =>
      setBusinessLogo(
        db,
        storage(),
        request.log,
        sessionUserOf(request).id,
        request.params.id,
        request.body,
      ),
  );

  app.put(
    '/products/:id/image',
    {
      schema: {
        summary: "Set a product's image from an upload (replaces the current one)",
        tags,
        params: IdParamsSchema,
        body: FinalizeUploadSchema,
        response: { 200: MediaSchema },
      },
    },
    (request) =>
      setProductImage(
        db,
        storage(),
        request.log,
        sessionUserOf(request).id,
        request.params.id,
        request.body,
      ),
  );

  app.patch(
    '/media/:id',
    {
      schema: {
        summary: "Edit an image's alt text",
        tags,
        params: IdParamsSchema,
        body: UpdateMediaSchema,
        response: { 200: MediaSchema },
      },
    },
    (request) =>
      updateMediaAlt(db, storage(), sessionUserOf(request).id, request.params.id, request.body),
  );

  app.delete(
    '/media/:id',
    {
      schema: {
        summary: 'Delete an image (a photo, logo or product image)',
        tags,
        params: IdParamsSchema,
        response: { 204: z.null() },
      },
    },
    async (request, reply) => {
      await deleteMedia(db, storage(), request.log, sessionUserOf(request).id, request.params.id);
      // 204 No Content: Fastify sends no body, whatever is passed here.
      return reply.status(204).send(null);
    },
  );
};

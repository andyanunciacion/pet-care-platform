// Images: branch photos, the business logo and product images (ARCHITECTURE D26, D38).
// The browser uploads straight to storage through a presigned URL (into tmp/); finalizing
// checks the upload, copies it to its final key and records the media row. Writes are
// audited on the owner (D36): photos on the branch, the logo and product images on the
// business.
import { randomUUID } from 'node:crypto';
import type { Db } from '@paw/db';
import { schema } from '@paw/db';
import {
  IMAGE_MAX_EDGE,
  MAX_PHOTOS_PER_BRANCH,
  MAX_UPLOAD_BYTES,
  UPLOAD_CONTENT_TYPES,
  UPLOAD_EXTENSIONS,
  UPLOAD_PURPOSES,
  type UploadPurpose,
} from '@paw/domain';
import { and, asc, eq, sql } from 'drizzle-orm';
import type { FastifyBaseLogger } from 'fastify';
import { z } from 'zod';
import { recordAudit, type Tx } from '../audit.ts';
import { httpError } from '../errors.ts';
import { UPLOAD_URL_TTL_SECONDS, type PhotoStorage } from '../storage.ts';
import { lockBranch } from './branch-hours.ts';
import { branchNotFound } from './branches.ts';
import { businessNotFound } from './businesses.ts';
import { lockBusiness, lockProduct } from './products.ts';

const { branch, business, media, product } = schema;

const MEDIA_KINDS = schema.mediaKind.enumValues;

type MediaRow = typeof media.$inferSelect;
type Log = Pick<FastifyBaseLogger, 'warn'>;

/** Uploads land here first; a bucket lifecycle rule deletes what's never finalized. */
const TMP_KEY = /^tmp\/[0-9a-f-]{36}\.(webp|jpg)$/;

// ── Input schemas ───────────────────────────────────────────────────────────────────────

export const CreateUploadSchema = z.object({
  purpose: z.enum(UPLOAD_PURPOSES),
  /** The branch (photo), business (logo) or product (image) the upload is for. */
  ownerId: z.uuid(),
  contentType: z.enum(UPLOAD_CONTENT_TYPES),
  /** In bytes, exactly: the presigned URL only accepts a file of this size. */
  contentLength: z
    .int()
    .min(1)
    .max(MAX_UPLOAD_BYTES, 'The image is over 2 MB, even after resizing. Try a smaller one.'),
});

const AltSchema = z
  .string()
  .trim()
  .min(1, "Describe the image for people who can't see it.")
  .max(300);

export const FinalizeUploadSchema = z.object({
  /** The key the upload URL was made for. */
  storageKey: z.string().regex(TMP_KEY, 'Not an upload from this admin.'),
  alt: AltSchema,
  /** In pixels, as resized in the browser. */
  width: z.int().min(1).max(IMAGE_MAX_EDGE.branch_photo),
  height: z.int().min(1).max(IMAGE_MAX_EDGE.branch_photo),
});

export const UpdateMediaSchema = z.object({ alt: AltSchema });

/** Every photo of the branch, in the new order. */
export const ReorderPhotosSchema = z.object({
  ids: z.array(z.uuid()).max(MAX_PHOTOS_PER_BRANCH),
});

type FinalizeInput = z.infer<typeof FinalizeUploadSchema>;

// ── Response schemas ────────────────────────────────────────────────────────────────────

export const UploadSchema = z.object({
  /** PUT the file here, with the same Content-Type, before it expires. */
  uploadUrl: z.url(),
  storageKey: z.string(),
  expiresAt: z.iso.datetime(),
});

export const MediaSchema = z.object({
  id: z.uuid(),
  kind: z.enum(MEDIA_KINDS),
  /** Public URL of the image. */
  url: z.string(),
  alt: z.string(),
  width: z.int(),
  height: z.int(),
  sortOrder: z.int(),
});

export const BranchPhotosSchema = z.object({
  branchId: z.uuid(),
  /** In display order. */
  photos: z.array(MediaSchema),
  limit: z.int(),
});

export const BusinessMediaSchema = z.object({
  businessId: z.uuid(),
  logo: MediaSchema.nullable(),
  productImages: z.array(z.object({ productId: z.uuid(), image: MediaSchema })),
});

export type Media = z.infer<typeof MediaSchema>;
export type BranchPhotos = z.infer<typeof BranchPhotosSchema>;
export type BusinessMedia = z.infer<typeof BusinessMediaSchema>;

// ── Helpers ─────────────────────────────────────────────────────────────────────────────

export const storageOff = () =>
  httpError(503, "Photo storage isn't set up. Add the R2_* variables to the API's environment.");

const mediaNotFound = () => httpError(404, 'No image with that id.');
const productNotFound = () => httpError(404, 'No product with that id.');

function toMedia(row: MediaRow, storage: PhotoStorage): Media {
  return {
    id: row.id,
    kind: row.kind,
    url: storage.publicUrl(row.storageKey),
    alt: row.alt,
    width: row.width,
    height: row.height,
    sortOrder: row.sortOrder,
  };
}

/** What audit_log records for an image. */
const auditImage = ({ alt, width, height }: Pick<MediaRow, 'alt' | 'width' | 'height'>) => ({
  alt,
  width,
  height,
});

/** Deletes an object after the database change committed. A failure leaves an orphan, not an error. */
async function deleteQuietly(storage: PhotoStorage, log: Log, key: string) {
  try {
    await storage.delete(key);
  } catch (error) {
    log.warn({ err: error, storageKey: key }, 'could not delete an image from storage');
  }
}

async function touchBranch(tx: Tx, branchId: string) {
  await tx.update(branch).set({ updatedAt: new Date() }).where(eq(branch.id, branchId));
}

async function touchBusiness(tx: Tx, businessId: string) {
  await tx.update(business).set({ updatedAt: new Date() }).where(eq(business.id, businessId));
}

async function branchPhotoCount(db: Pick<Db, '$count'>, branchId: string) {
  return db.$count(media, eq(media.branchId, branchId));
}

function tooManyPhotos() {
  return httpError(
    409,
    `This branch already has ${String(MAX_PHOTOS_PER_BRANCH)} photos. Delete one first.`,
  );
}

/** Checks that the browser's upload arrived and is what the upload URL was made for. */
async function checkUpload(storage: PhotoStorage, input: FinalizeInput, purpose: UploadPurpose) {
  const fail = (message: string, pointer = '/storageKey') =>
    httpError(400, message, [{ pointer, message }]);

  const maxEdge = IMAGE_MAX_EDGE[purpose];
  if (input.width > maxEdge) throw fail(`At most ${String(maxEdge)} pixels wide.`, '/width');
  if (input.height > maxEdge) throw fail(`At most ${String(maxEdge)} pixels high.`, '/height');

  const object = await storage.head(input.storageKey);
  if (object === null) throw fail("The upload didn't arrive. Try again.");
  const contentType = UPLOAD_CONTENT_TYPES.find((type) => type === object.contentType);
  if (
    contentType === undefined ||
    !input.storageKey.endsWith(`.${UPLOAD_EXTENSIONS[contentType]}`)
  ) {
    throw fail('The upload is not a WebP or JPEG image.');
  }
  if (object.contentLength > MAX_UPLOAD_BYTES) throw fail('The upload is over 2 MB.');
  return contentType;
}

/**
 * Copies a checked upload to its final key and runs the database write. If the write fails,
 * the copy is deleted; once it commits, the tmp upload and any replaced image are deleted.
 */
async function finalize<T>(
  db: Db,
  storage: PhotoStorage,
  log: Log,
  input: FinalizeInput,
  purpose: UploadPurpose,
  finalKeyFor: (extension: string) => string,
  write: (tx: Tx, finalKey: string) => Promise<{ result: T; replacedKeys: string[] }>,
): Promise<T> {
  const contentType = await checkUpload(storage, input, purpose);
  const finalKey = finalKeyFor(UPLOAD_EXTENSIONS[contentType]);
  await storage.copy(input.storageKey, finalKey, contentType);

  let outcome: { result: T; replacedKeys: string[] };
  try {
    outcome = await db.transaction((tx) => write(tx, finalKey));
  } catch (error) {
    await deleteQuietly(storage, log, finalKey);
    throw error;
  }
  for (const key of [input.storageKey, ...outcome.replacedKeys]) {
    await deleteQuietly(storage, log, key);
  }
  return outcome.result;
}

// ── Upload URLs ─────────────────────────────────────────────────────────────────────────

/** A presigned URL for the browser to upload one image to (nothing is recorded yet). */
export async function createUpload(
  db: Db,
  storage: PhotoStorage,
  input: z.infer<typeof CreateUploadSchema>,
): Promise<z.infer<typeof UploadSchema>> {
  if (input.purpose === 'branch_photo') {
    const [found] = await db
      .select({ id: branch.id })
      .from(branch)
      .where(eq(branch.id, input.ownerId));
    if (found === undefined) throw branchNotFound();
    if ((await branchPhotoCount(db, input.ownerId)) >= MAX_PHOTOS_PER_BRANCH) throw tooManyPhotos();
  } else if (input.purpose === 'business_logo') {
    const [found] = await db
      .select({ id: business.id })
      .from(business)
      .where(eq(business.id, input.ownerId));
    if (found === undefined) throw businessNotFound();
  } else {
    const [found] = await db
      .select({ id: product.id })
      .from(product)
      .where(eq(product.id, input.ownerId));
    if (found === undefined) throw productNotFound();
  }

  const storageKey = `tmp/${randomUUID()}.${UPLOAD_EXTENSIONS[input.contentType]}`;
  return {
    uploadUrl: await storage.presignPut(storageKey, input.contentType, input.contentLength),
    storageKey,
    expiresAt: new Date(Date.now() + UPLOAD_URL_TTL_SECONDS * 1000).toISOString(),
  };
}

// ── Queries ─────────────────────────────────────────────────────────────────────────────

export async function listBranchPhotos(
  db: Db,
  storage: PhotoStorage,
  branchId: string,
): Promise<BranchPhotos> {
  const [found] = await db.select({ id: branch.id }).from(branch).where(eq(branch.id, branchId));
  if (found === undefined) throw branchNotFound();
  const rows = await db
    .select()
    .from(media)
    .where(eq(media.branchId, branchId))
    .orderBy(asc(media.sortOrder), asc(media.id));
  return {
    branchId,
    photos: rows.map((row) => toMedia(row, storage)),
    limit: MAX_PHOTOS_PER_BRANCH,
  };
}

/** The business's logo and its products' images. */
export async function getBusinessMedia(
  db: Db,
  storage: PhotoStorage,
  businessId: string,
): Promise<BusinessMedia> {
  const [found] = await db
    .select({ id: business.id })
    .from(business)
    .where(eq(business.id, businessId));
  if (found === undefined) throw businessNotFound();

  const [logos, images] = await Promise.all([
    db
      .select()
      .from(media)
      .where(and(eq(media.businessId, businessId), eq(media.kind, 'logo'))),
    db
      .select({ media })
      .from(media)
      .innerJoin(product, eq(product.id, media.productId))
      .where(eq(product.businessId, businessId))
      .orderBy(asc(media.sortOrder), asc(media.id)),
  ]);
  const [logo] = logos;

  // One image per product: the first, should an older write have left more.
  const productImages = new Map<string, Media>();
  for (const { media: row } of images) {
    if (row.productId !== null && !productImages.has(row.productId)) {
      productImages.set(row.productId, toMedia(row, storage));
    }
  }
  return {
    businessId,
    logo: logo === undefined ? null : toMedia(logo, storage),
    productImages: [...productImages].map(([productId, image]) => ({ productId, image })),
  };
}

// ── Writes (each one records an audit_log entry in the same transaction) ────────────────

export async function addBranchPhoto(
  db: Db,
  storage: PhotoStorage,
  log: Log,
  actorId: string,
  branchId: string,
  input: FinalizeInput,
): Promise<Media> {
  return finalize(
    db,
    storage,
    log,
    input,
    'branch_photo',
    (extension) => `branches/${branchId}/${randomUUID()}.${extension}`,
    async (tx, storageKey) => {
      await lockBranch(tx, branchId);
      if ((await branchPhotoCount(tx, branchId)) >= MAX_PHOTOS_PER_BRANCH) throw tooManyPhotos();
      const [next] = await tx
        .select({ value: sql`coalesce(max(${media.sortOrder}), -1) + 1`.mapWith(Number) })
        .from(media)
        .where(eq(media.branchId, branchId));

      const [row] = await tx
        .insert(media)
        .values({
          kind: 'photo',
          storageKey,
          alt: input.alt,
          width: input.width,
          height: input.height,
          branchId,
          sortOrder: next?.value ?? 0,
        })
        .returning();
      if (row === undefined) throw new Error('insert returned no row');
      await touchBranch(tx, branchId);

      await recordAudit(tx, {
        actorId,
        action: 'branch.add_photo',
        entityType: 'branch',
        entityId: branchId,
        diff: { photo: { from: null, to: auditImage(row) } },
      });
      return { result: toMedia(row, storage), replacedKeys: [] };
    },
  );
}

/** Sets the business's logo, replacing the current one. */
export async function setBusinessLogo(
  db: Db,
  storage: PhotoStorage,
  log: Log,
  actorId: string,
  businessId: string,
  input: FinalizeInput,
): Promise<Media> {
  return finalize(
    db,
    storage,
    log,
    input,
    'business_logo',
    (extension) => `businesses/${businessId}/logo-${randomUUID()}.${extension}`,
    async (tx, storageKey) => {
      await lockBusiness(tx, businessId);
      // One logo per business (a unique index): remove the old row before adding the new one.
      const [old] = await tx
        .delete(media)
        .where(and(eq(media.businessId, businessId), eq(media.kind, 'logo')))
        .returning();
      const [row] = await tx
        .insert(media)
        .values({ kind: 'logo', storageKey, alt: input.alt, ...size(input), businessId })
        .returning();
      if (row === undefined) throw new Error('insert returned no row');
      await touchBusiness(tx, businessId);

      await recordAudit(tx, {
        actorId,
        action: 'business.set_logo',
        entityType: 'business',
        entityId: businessId,
        diff: { logo: { from: old === undefined ? null : auditImage(old), to: auditImage(row) } },
      });
      return {
        result: toMedia(row, storage),
        replacedKeys: old === undefined ? [] : [old.storageKey],
      };
    },
  );
}

/** Sets a product's image, replacing the current one. */
export async function setProductImage(
  db: Db,
  storage: PhotoStorage,
  log: Log,
  actorId: string,
  productId: string,
  input: FinalizeInput,
): Promise<Media> {
  return finalize(
    db,
    storage,
    log,
    input,
    'product_image',
    (extension) => `products/${productId}/${randomUUID()}.${extension}`,
    async (tx, storageKey) => {
      const owner = await lockProduct(tx, productId);
      const old = await tx.delete(media).where(eq(media.productId, productId)).returning();
      const [row] = await tx
        .insert(media)
        .values({ kind: 'photo', storageKey, alt: input.alt, ...size(input), productId })
        .returning();
      if (row === undefined) throw new Error('insert returned no row');
      await touchBusiness(tx, owner.businessId);

      const [previous] = old;
      await recordAudit(tx, {
        actorId,
        action: 'business.set_product_image',
        entityType: 'business',
        entityId: owner.businessId,
        diff: {
          productImage: {
            from: previous === undefined ? null : { product: owner.name, ...auditImage(previous) },
            to: { product: owner.name, ...auditImage(row) },
          },
        },
      });
      return { result: toMedia(row, storage), replacedKeys: old.map((m) => m.storageKey) };
    },
  );
}

const size = ({ width, height }: { width: number; height: number }) => ({ width, height });

/** Who an image belongs to, with the owner row locked, and the audit wording for it. */
async function lockMedia(tx: Tx, mediaId: string) {
  const [found] = await tx.select().from(media).where(eq(media.id, mediaId));
  if (found === undefined) throw mediaNotFound();

  let audit: { entityType: 'branch' | 'business'; entityId: string; key: string; action: string };
  let productName: string | null = null;
  if (found.branchId !== null) {
    await lockBranch(tx, found.branchId);
    audit = { entityType: 'branch', entityId: found.branchId, key: 'photo', action: 'photo' };
  } else if (found.businessId !== null) {
    // Business images are only logos for now (business photos aren't edited in P1).
    await lockBusiness(tx, found.businessId);
    audit = { entityType: 'business', entityId: found.businessId, key: 'logo', action: 'logo' };
  } else if (found.productId !== null) {
    const owner = await lockProduct(tx, found.productId);
    productName = owner.name;
    audit = {
      entityType: 'business',
      entityId: owner.businessId,
      key: 'productImage',
      action: 'product_image',
    };
  } else {
    throw new Error('media without an owner');
  }

  // Read again under the lock: a concurrent delete may have won.
  const [row] = await tx.select().from(media).where(eq(media.id, mediaId));
  if (row === undefined) throw mediaNotFound();
  const describe = (r: MediaRow) =>
    productName === null ? auditImage(r) : { product: productName, ...auditImage(r) };
  return { row, audit, describe };
}

async function touchOwner(tx: Tx, row: MediaRow, businessId: string) {
  if (row.branchId !== null) await touchBranch(tx, row.branchId);
  else await touchBusiness(tx, businessId);
}

export async function updateMediaAlt(
  db: Db,
  storage: PhotoStorage,
  actorId: string,
  mediaId: string,
  input: z.infer<typeof UpdateMediaSchema>,
): Promise<Media> {
  return db.transaction(async (tx) => {
    const { row: before, audit, describe } = await lockMedia(tx, mediaId);
    if (before.alt === input.alt) return toMedia(before, storage);

    const [row] = await tx
      .update(media)
      .set({ alt: input.alt, updatedAt: new Date() })
      .where(eq(media.id, mediaId))
      .returning();
    if (row === undefined) throw new Error('update returned no row');
    await touchOwner(tx, row, audit.entityId);

    await recordAudit(tx, {
      actorId,
      action: `${audit.entityType}.update_${audit.action}`,
      entityType: audit.entityType,
      entityId: audit.entityId,
      diff: { [audit.key]: { from: describe(before), to: describe(row) } },
    });
    return toMedia(row, storage);
  });
}

export async function deleteMedia(
  db: Db,
  storage: PhotoStorage,
  log: Log,
  actorId: string,
  mediaId: string,
): Promise<void> {
  const storageKey = await db.transaction(async (tx) => {
    const { row, audit, describe } = await lockMedia(tx, mediaId);
    await tx.delete(media).where(eq(media.id, mediaId));
    await touchOwner(tx, row, audit.entityId);

    await recordAudit(tx, {
      actorId,
      action: `${audit.entityType}.delete_${audit.action}`,
      entityType: audit.entityType,
      entityId: audit.entityId,
      diff: { [audit.key]: { from: describe(row), to: null } },
    });
    return row.storageKey;
  });
  await deleteQuietly(storage, log, storageKey);
}

export async function reorderBranchPhotos(
  db: Db,
  storage: PhotoStorage,
  actorId: string,
  branchId: string,
  input: z.infer<typeof ReorderPhotosSchema>,
): Promise<BranchPhotos> {
  await db.transaction(async (tx) => {
    await lockBranch(tx, branchId);
    const rows = await tx
      .select()
      .from(media)
      .where(eq(media.branchId, branchId))
      .orderBy(asc(media.sortOrder), asc(media.id));

    const current = rows.map((row) => row.id);
    const sameSet =
      input.ids.length === current.length &&
      new Set(input.ids).size === current.length &&
      input.ids.every((id) => current.includes(id));
    if (!sameSet) {
      const message = 'The photos changed since the page loaded. Reload and try again.';
      throw httpError(400, message, [{ pointer: '/ids', message }]);
    }
    if (input.ids.every((id, index) => id === current[index])) return;

    for (const [index, id] of input.ids.entries()) {
      await tx.update(media).set({ sortOrder: index }).where(eq(media.id, id));
    }
    await touchBranch(tx, branchId);

    const altOf = (id: string) => rows.find((row) => row.id === id)?.alt ?? id;
    await recordAudit(tx, {
      actorId,
      action: 'branch.reorder_photos',
      entityType: 'branch',
      entityId: branchId,
      diff: { photoOrder: { from: current.map(altOf), to: input.ids.map(altOf) } },
    });
  });
  return listBranchPhotos(db, storage, branchId);
}

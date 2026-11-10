// Products a business sells, shown read-only on its page (no cart, no stock counts; PRD).
// Writes are audited on the business (ARCHITECTURE D36). The product image comes with the
// photo uploads (P1-2d, second part).
import type { Db } from '@paw/db';
import { schema } from '@paw/db';
import { MAX_PRICE_CENTAVOS } from '@paw/domain';
import { asc, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { diffFields, recordAudit, type Tx } from '../audit.ts';
import { httpError } from '../errors.ts';
import { businessNotFound, emptyToNull, NameSchema } from './businesses.ts';

const { business, product } = schema;

export const PRODUCT_AVAILABILITIES = schema.productAvailability.enumValues;

// ── Input schemas ───────────────────────────────────────────────────────────────────────

const productFields = {
  name: NameSchema,
  /** Free text for now, e.g. "Food", "Accessories". */
  category: z.string().trim().max(100).nullable(),
  /** In centavos. Null shows "Ask for price". */
  price: z
    .int()
    .min(0, "A price can't be negative.")
    .max(MAX_PRICE_CENTAVOS, "That's over ₱1,000,000. Check for an extra zero.")
    .nullable(),
  availability: z.enum(PRODUCT_AVAILABILITIES),
};

export const CreateProductSchema = z.object({
  ...productFields,
  category: productFields.category.default(null),
  price: productFields.price.default(null),
  availability: productFields.availability.default('available'),
});

/** Only the fields sent are changed. */
export const UpdateProductSchema = z.object(productFields).partial();

type CreateProductInput = z.infer<typeof CreateProductSchema>;
type UpdateProductInput = z.infer<typeof UpdateProductSchema>;

// ── Response schemas ────────────────────────────────────────────────────────────────────

export const ProductSchema = z.object({
  id: z.uuid(),
  businessId: z.uuid(),
  name: z.string(),
  category: z.string().nullable(),
  price: z.int().nullable(),
  availability: z.enum(PRODUCT_AVAILABILITIES),
  updatedAt: z.iso.datetime(),
});

export const ProductListSchema = z.array(ProductSchema);

export type Product = z.infer<typeof ProductSchema>;

// ── Helpers ─────────────────────────────────────────────────────────────────────────────

const productNotFound = () => httpError(404, 'No product with that id.');

const AUDITED_FIELDS = ['name', 'category', 'price', 'availability'] as const;

type ProductRow = typeof product.$inferSelect;

function toProduct(row: ProductRow): Product {
  return {
    id: row.id,
    businessId: row.businessId,
    name: row.name,
    category: row.category,
    price: row.price,
    availability: row.availability,
    updatedAt: row.updatedAt.toISOString(),
  };
}

const auditProduct = ({ name, category, price, availability }: ProductRow) => ({
  name,
  category,
  price,
  availability,
});

/**
 * Locks the business row, so writes to its products and images queue up (accurate audit
 * "from" values).
 */
export async function lockBusiness(tx: Tx, businessId: string) {
  const [row] = await tx
    .select({ id: business.id })
    .from(business)
    .where(eq(business.id, businessId))
    .for('update');
  if (row === undefined) throw businessNotFound();
}

/** Locks the product's business, then reads the product for a write. */
export async function lockProduct(tx: Tx, productId: string): Promise<ProductRow> {
  const [found] = await tx
    .select({ businessId: product.businessId })
    .from(product)
    .where(eq(product.id, productId));
  if (found === undefined) throw productNotFound();
  await lockBusiness(tx, found.businessId);
  // Read again under the lock: a concurrent delete may have won.
  const [row] = await tx.select().from(product).where(eq(product.id, productId));
  if (row === undefined) throw productNotFound();
  return row;
}

// ── Queries ─────────────────────────────────────────────────────────────────────────────

/** By category (uncategorized last), then name. */
export async function listProducts(db: Db, businessId: string): Promise<Product[]> {
  const [owner] = await db
    .select({ id: business.id })
    .from(business)
    .where(eq(business.id, businessId));
  if (owner === undefined) throw businessNotFound();

  const rows = await db
    .select()
    .from(product)
    .where(eq(product.businessId, businessId))
    .orderBy(sql`${product.category} asc nulls last`, asc(product.name), asc(product.id));
  return rows.map(toProduct);
}

// ── Writes (each one records an audit_log entry in the same transaction) ────────────────

export async function createProduct(
  db: Db,
  actorId: string,
  businessId: string,
  input: CreateProductInput,
): Promise<Product> {
  return db.transaction(async (tx) => {
    await lockBusiness(tx, businessId);
    const [row] = await tx
      .insert(product)
      .values({ ...input, category: emptyToNull(input.category), businessId })
      .returning();
    if (row === undefined) throw new Error('insert returned no row');

    await recordAudit(tx, {
      actorId,
      action: 'business.create_product',
      entityType: 'business',
      entityId: businessId,
      diff: diffFields(null, { product: auditProduct(row) }, ['product']),
    });
    return toProduct(row);
  });
}

export async function updateProduct(
  db: Db,
  actorId: string,
  productId: string,
  patch: UpdateProductInput,
): Promise<Product> {
  return db.transaction(async (tx) => {
    const before = await lockProduct(tx, productId);
    const changes = {
      ...patch,
      ...(patch.category !== undefined && { category: emptyToNull(patch.category) }),
    };
    const after = { ...before, ...changes };
    if (Object.keys(diffFields(before, after, AUDITED_FIELDS)).length === 0) {
      return toProduct(before);
    }

    const [row] = await tx
      .update(product)
      .set({ ...changes, updatedAt: new Date() })
      .where(eq(product.id, productId))
      .returning();
    if (row === undefined) throw new Error('update returned no row');

    await recordAudit(tx, {
      actorId,
      action: 'business.update_product',
      entityType: 'business',
      entityId: row.businessId,
      diff: diffFields({ product: auditProduct(before) }, { product: auditProduct(row) }, [
        'product',
      ]),
    });
    return toProduct(row);
  });
}

export async function deleteProduct(db: Db, actorId: string, productId: string): Promise<void> {
  await db.transaction(async (tx) => {
    const before = await lockProduct(tx, productId);
    await tx.delete(product).where(eq(product.id, productId));

    await recordAudit(tx, {
      actorId,
      action: 'business.delete_product',
      entityType: 'business',
      entityId: before.businessId,
      diff: { product: { from: auditProduct(before), to: null } },
    });
  });
}

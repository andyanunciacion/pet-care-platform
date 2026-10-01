import { randomBytes } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDatabase } from '../client.ts';
import {
  insertTestAreas,
  insertTestBranch,
  insertTestBusiness,
  testDatabaseUrl,
  violatedConstraint,
} from '../testing/index.ts';
import { auditLog } from './audit.ts';
import { branch } from './branch.ts';
import { media } from './media.ts';
import { product } from './product.ts';

const database = createDatabase({ connectionString: testDatabaseUrl() });
const { db } = database;

beforeAll(async () => {
  await insertTestAreas(db);
});

afterAll(async () => {
  await database.close();
});

/** Valid photo values without an owner; spread in the owner and overrides. */
function photo() {
  return {
    kind: 'photo' as const,
    storageKey: `test/${randomBytes(6).toString('hex')}.webp`,
    alt: 'The clinic entrance',
    width: 1200,
    height: 800,
  };
}

describe('product', () => {
  it('starts available, with an optional price', async () => {
    const { id: businessId } = await insertTestBusiness(db);
    const [row] = await db.insert(product).values({ businessId, name: 'Dog food 1kg' }).returning();
    expect(row).toMatchObject({ availability: 'available', price: null });
  });

  it('rejects negative prices', async () => {
    const { id: businessId } = await insertTestBusiness(db);
    const query = db.insert(product).values({ businessId, name: 'Leash', price: -1 });
    expect(await violatedConstraint(query)).toBe('product_price_positive');
  });
});

describe('media', () => {
  it('belongs to exactly one business, branch or product', async () => {
    const { id: businessId } = await insertTestBusiness(db);
    const { id: branchId } = await insertTestBranch(db, businessId);

    const noOwner = db.insert(media).values(photo());
    expect(await violatedConstraint(noOwner)).toBe('media_one_owner');

    const twoOwners = db.insert(media).values({ ...photo(), businessId, branchId });
    expect(await violatedConstraint(twoOwners)).toBe('media_one_owner');

    await expect(db.insert(media).values({ ...photo(), branchId })).resolves.toBeDefined();
  });

  it('requires alt text and real dimensions', async () => {
    const { id: businessId } = await insertTestBusiness(db);
    const blankAlt = db.insert(media).values({ ...photo(), businessId, alt: '  ' });
    expect(await violatedConstraint(blankAlt)).toBe('media_alt_not_blank');

    const noWidth = db.insert(media).values({ ...photo(), businessId, width: 0 });
    expect(await violatedConstraint(noWidth)).toBe('media_dimensions_positive');
  });

  it('allows one logo per business, and only on a business', async () => {
    const { id: businessId } = await insertTestBusiness(db);
    const logo = { ...photo(), kind: 'logo' as const, alt: 'Test Vet Clinic logo' };
    await db.insert(media).values({ ...logo, businessId });

    const secondLogo = db
      .insert(media)
      .values({ ...logo, storageKey: photo().storageKey, businessId });
    expect(await violatedConstraint(secondLogo)).toBe('media_one_logo_per_business');

    const { id: branchId } = await insertTestBranch(db, businessId);
    const branchLogo = db
      .insert(media)
      .values({ ...logo, storageKey: photo().storageKey, branchId });
    expect(await violatedConstraint(branchLogo)).toBe('media_logo_on_business');
  });

  it('is deleted along with its owner', async () => {
    const { id: businessId } = await insertTestBusiness(db);
    const { id: branchId } = await insertTestBranch(db, businessId);
    const [image] = await db
      .insert(media)
      .values({ ...photo(), branchId })
      .returning();

    await db.delete(branch).where(eq(branch.id, branchId));
    expect(
      await db
        .select()
        .from(media)
        .where(eq(media.id, image?.id ?? '')),
    ).toEqual([]);
  });
});

describe('audit_log', () => {
  it('records a change, with or without an actor', async () => {
    const { id: entityId } = await insertTestBusiness(db);
    const [row] = await db
      .insert(auditLog)
      .values({
        action: 'business.update',
        entityType: 'business',
        entityId,
        diff: { name: { from: 'Old Name', to: 'New Name' } },
      })
      .returning();
    expect(row).toMatchObject({
      actorId: null,
      diff: { name: { from: 'Old Name', to: 'New Name' } },
    });
  });
});

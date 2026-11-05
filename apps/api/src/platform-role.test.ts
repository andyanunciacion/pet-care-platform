import { createDatabase, schema } from '@paw/db';
import { insertTestUser, testDatabaseUrl } from '@paw/db/testing';
import { eq } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { setPlatformRole } from './platform-role.ts';

const database = createDatabase({ connectionString: testDatabaseUrl() });
const { db } = database;

afterAll(async () => {
  await database.close();
});

async function roleOf(userId: string) {
  const [row] = await db
    .select({ platformRole: schema.user.platformRole })
    .from(schema.user)
    .where(eq(schema.user.id, userId));
  return row?.platformRole;
}

async function auditEntries(userId: string) {
  return db.select().from(schema.auditLog).where(eq(schema.auditLog.entityId, userId));
}

describe('setPlatformRole', () => {
  it('promotes a user and records it in the audit log', async () => {
    const user = await insertTestUser(db);

    // Any capitalization works: emails are stored lowercase.
    const result = await setPlatformRole(db, {
      email: `  ${user.email.toUpperCase()} `,
      role: 'super_admin',
    });

    expect(result).toEqual({ userId: user.id, from: 'user', to: 'super_admin' });
    expect(await roleOf(user.id)).toBe('super_admin');
    expect(await auditEntries(user.id)).toMatchObject([
      {
        actorId: null,
        action: 'user.set_platform_role',
        entityType: 'user',
        diff: { platformRole: { from: 'user', to: 'super_admin' } },
      },
    ]);
  });

  it('demotes too', async () => {
    const admin = await insertTestUser(db, { platformRole: 'super_admin' });
    await setPlatformRole(db, { email: admin.email, role: 'user' });
    expect(await roleOf(admin.id)).toBe('user');
  });

  it('changes nothing and logs nothing when the role is already set', async () => {
    const admin = await insertTestUser(db, { platformRole: 'super_admin' });
    const result = await setPlatformRole(db, { email: admin.email, role: 'super_admin' });

    expect(result.from).toBe(result.to);
    expect(await auditEntries(admin.id)).toEqual([]);
  });

  it('fails clearly for an email that has never signed in', async () => {
    await expect(
      setPlatformRole(db, { email: 'nobody-here@example.test', role: 'super_admin' }),
    ).rejects.toThrow(/Sign in once/);
  });
});

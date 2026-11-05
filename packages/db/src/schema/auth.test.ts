import { randomUUID } from 'node:crypto';
import { eq, sql } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { createDatabase } from '../client.ts';
import { insertTestUser, testDatabaseUrl, violatedConstraint } from '../testing/index.ts';
import { auditLog } from './audit.ts';
import { account, session, user } from './auth.ts';

const database = createDatabase({ connectionString: testDatabaseUrl() });
const { db } = database;

afterAll(async () => {
  await database.close();
});

describe('user', () => {
  it('starts as a plain user with a UUID v7 id', async () => {
    const row = await insertTestUser(db);
    expect(row.platformRole).toBe('user');
    expect(row.emailVerified).toBe(false);
    expect(row.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7/);
  });

  it('has a unique email', async () => {
    const { email } = await insertTestUser(db);
    expect(await violatedConstraint(insertTestUser(db, { email }))).toBe('user_email_unique');
  });

  it('only accepts known platform roles', async () => {
    const row = await insertTestUser(db);
    await expect(
      db.execute(sql`update "user" set platform_role = 'owner' where id = ${row.id}`),
    ).rejects.toThrow();
  });

  it('deletes its sessions and accounts with it', async () => {
    const row = await insertTestUser(db);
    await db.insert(session).values({
      userId: row.id,
      token: randomUUID(),
      expiresAt: new Date(Date.now() + 60_000),
    });
    await db
      .insert(account)
      .values({ userId: row.id, providerId: 'google', accountId: randomUUID() });

    await db.delete(user).where(eq(user.id, row.id));

    expect(await db.select().from(session).where(eq(session.userId, row.id))).toEqual([]);
    expect(await db.select().from(account).where(eq(account.userId, row.id))).toEqual([]);
  });
});

describe('account', () => {
  it('links one provider account to one user', async () => {
    const first = await insertTestUser(db);
    const second = await insertTestUser(db);
    const accountId = randomUUID();
    await db.insert(account).values({ userId: first.id, providerId: 'google', accountId });

    expect(
      await violatedConstraint(
        db.insert(account).values({ userId: second.id, providerId: 'google', accountId }),
      ),
    ).toBe('account_providerId_accountId_unique');
  });
});

describe('audit_log.actor_id', () => {
  const entry = { action: 'test.action', entityType: 'test', entityId: randomUUID() };

  it('must be an existing user', async () => {
    expect(
      await violatedConstraint(db.insert(auditLog).values({ ...entry, actorId: randomUUID() })),
    ).toBe('audit_log_actor_id_user_id_fk');
  });

  it('may be null (scripts)', async () => {
    const [row] = await db.insert(auditLog).values(entry).returning();
    expect(row?.actorId).toBeNull();
  });

  it('keeps users with audit history from being deleted', async () => {
    const actor = await insertTestUser(db);
    await db.insert(auditLog).values({ ...entry, actorId: actor.id });
    expect(await violatedConstraint(db.delete(user).where(eq(user.id, actor.id)))).toBe(
      'audit_log_actor_id_user_id_fk',
    );
  });
});

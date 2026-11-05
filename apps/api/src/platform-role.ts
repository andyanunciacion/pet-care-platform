import type { Db } from '@paw/db';
import { schema } from '@paw/db';
import { eq } from 'drizzle-orm';
import type { PlatformRole } from './auth.ts';

export interface SetPlatformRoleResult {
  userId: string;
  from: PlatformRole;
  to: PlatformRole;
}

/**
 * Gives an existing user a platform role and records it in the audit log, in one
 * transaction. The user must have signed in once (that's what creates the account).
 * `actorId` is null: this runs from the command line, not as a signed-in user.
 */
export async function setPlatformRole(
  db: Db,
  { email, role }: { email: string; role: PlatformRole },
): Promise<SetPlatformRoleResult> {
  return db.transaction(async (tx) => {
    const [existing] = await tx
      .select({ id: schema.user.id, platformRole: schema.user.platformRole })
      .from(schema.user)
      // Better Auth stores emails lowercase.
      .where(eq(schema.user.email, email.trim().toLowerCase()))
      .for('update');
    if (existing === undefined) {
      throw new Error('No user with that email. Sign in once with it first, then run this again.');
    }

    const result = { userId: existing.id, from: existing.platformRole, to: role };
    if (result.from === result.to) return result;

    await tx.update(schema.user).set({ platformRole: role }).where(eq(schema.user.id, existing.id));
    await tx.insert(schema.auditLog).values({
      actorId: null,
      action: 'user.set_platform_role',
      entityType: 'user',
      entityId: existing.id,
      diff: { platformRole: { from: result.from, to: result.to } },
    });
    return result;
  });
}

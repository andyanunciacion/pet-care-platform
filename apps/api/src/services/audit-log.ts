import type { Db } from '@paw/db';
import { schema } from '@paw/db';
import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { z } from 'zod';

const { auditLog, branch, user } = schema;

export const ListAuditLogQuerySchema = z.object({
  /** e.g. "business", "branch". */
  entityType: z.string().max(50).optional(),
  entityId: z.uuid().optional(),
  /** A business's whole trail: the business itself plus all its branches. */
  businessId: z.uuid().optional(),
  /** Cursor: entries older than the entry with this id (the previous page's `nextBefore`). */
  before: z.uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export const AuditLogPageSchema = z.object({
  items: z.array(
    z.object({
      id: z.uuid(),
      action: z.string(),
      entityType: z.string(),
      entityId: z.uuid(),
      diff: z.record(z.string(), z.object({ from: z.unknown(), to: z.unknown() })).nullable(),
      /** Null for scripts (e.g. promote-admin). */
      actor: z.object({ id: z.uuid(), name: z.string(), email: z.string() }).nullable(),
      createdAt: z.iso.datetime(),
    }),
  ),
  /** Pass as `before` for the next (older) page; null on the last page. */
  nextBefore: z.uuid().nullable(),
});

/** Audit entries, newest first. */
export async function listAuditLog(
  db: Db,
  query: z.infer<typeof ListAuditLogQuerySchema>,
): Promise<z.infer<typeof AuditLogPageSchema>> {
  let entityIds: string[] | undefined;
  if (query.businessId !== undefined) {
    const branches = await db
      .select({ id: branch.id })
      .from(branch)
      .where(eq(branch.businessId, query.businessId));
    entityIds = [query.businessId, ...branches.map((b) => b.id)];
  }

  // One extra row tells us whether there's another page.
  const rows = await db
    .select({ entry: auditLog, actor: { id: user.id, name: user.name, email: user.email } })
    .from(auditLog)
    .leftJoin(user, eq(user.id, auditLog.actorId))
    .where(
      and(
        query.entityType === undefined ? undefined : eq(auditLog.entityType, query.entityType),
        query.entityId === undefined ? undefined : eq(auditLog.entityId, query.entityId),
        entityIds === undefined ? undefined : inArray(auditLog.entityId, entityIds),
        query.before === undefined
          ? undefined
          : // Row comparison: older than the cursor entry, ties broken by id.
            sql`(${auditLog.createdAt}, ${auditLog.id}) < (select ${auditLog.createdAt}, ${auditLog.id} from ${auditLog} where ${auditLog.id} = ${query.before})`,
      ),
    )
    // created_at has microseconds; ids only milliseconds (UUID v7), so time sorts first.
    .orderBy(desc(auditLog.createdAt), desc(auditLog.id))
    .limit(query.limit + 1);

  const page = rows.slice(0, query.limit);
  return {
    items: page.map(({ entry, actor }) => ({
      id: entry.id,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId,
      diff: entry.diff,
      actor,
      createdAt: entry.createdAt.toISOString(),
    })),
    nextBefore: rows.length > query.limit ? (page.at(-1)?.entry.id ?? null) : null,
  };
}

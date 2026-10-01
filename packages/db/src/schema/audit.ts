import { index, jsonb, pgTable, text, uuid } from 'drizzle-orm/pg-core';
import { id, timestamps } from './columns.ts';

/**
 * Every write from /dashboard or /admin, recorded in the same transaction as the write.
 * Append-only: rows are never updated, so there's no updated_at.
 */
export const auditLog = pgTable(
  'audit_log',
  {
    id: id(),
    /**
     * The user who made the change; null for scripts (e.g. a CSV import run from the
     * command line). The foreign key to the user table is added with auth (P1-2a).
     */
    actorId: uuid(),
    /** What happened, e.g. "branch.update", "hours.confirm". */
    action: text().notNull(),
    /** The table name of the changed row, e.g. "branch". */
    entityType: text().notNull(),
    entityId: uuid().notNull(),
    /** Changed fields as { field: { from, to } }. Never contains personal data beyond what the row itself holds. */
    diff: jsonb().$type<Record<string, { from: unknown; to: unknown }>>(),
    createdAt: timestamps.createdAt,
  },
  (table) => [
    // The audit log viewer lists one entity's history, newest first.
    index().on(table.entityType, table.entityId, table.createdAt.desc()),
    index().on(table.actorId),
  ],
);

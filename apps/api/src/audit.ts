import { isDeepStrictEqual } from 'node:util';
import type { Db } from '@paw/db';
import { schema } from '@paw/db';

/** A transaction handle, as `db.transaction(async (tx) => …)` passes it. */
export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];

/** Changed fields as { field: { from, to } } (the audit_log.diff column). */
export type AuditDiff = Record<string, { from: unknown; to: unknown }>;

/**
 * The fields that differ between two versions of a row. `before = null` means the row is
 * new: every field that has a value is listed with `from: null`. Values are compared
 * deeply, so map points and contact lists only count as changed when their contents do.
 */
export function diffFields<T extends object>(
  before: T | null,
  after: T,
  fields: readonly (keyof T & string)[],
): AuditDiff {
  const diff: AuditDiff = {};
  for (const field of fields) {
    const from = before === null ? null : before[field];
    const to = after[field];
    if (before === null && (to === null || to === undefined)) continue;
    if (!isDeepStrictEqual(from, to)) diff[field] = { from, to };
  }
  return diff;
}

export interface AuditEntry {
  /** The signed-in user, or null for scripts. */
  actorId: string | null;
  /** e.g. "business.create", "branch.update". */
  action: string;
  /** The table name of the changed row. */
  entityType: string;
  entityId: string;
  diff: AuditDiff;
}

/**
 * Appends an audit_log row. Call it inside the same transaction as the write, so the
 * change and its record commit (or roll back) together. An empty diff records nothing:
 * saving a form without changing anything isn't an event.
 */
export async function recordAudit(tx: Tx, entry: AuditEntry): Promise<void> {
  if (Object.keys(entry.diff).length === 0) return;
  await tx.insert(schema.auditLog).values(entry);
}

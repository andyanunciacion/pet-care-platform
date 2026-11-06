// A branch's opening hours: the weekly schedule, date exceptions (holidays, "Closed today")
// and the hours confirmation (DESIGN UX13, ARCHITECTURE D28 and D35).
import type { Db } from '@paw/db';
import { schema } from '@paw/db';
import {
  addDays,
  dayIntervalsIssues,
  hasHoursData,
  MAX_INTERVALS_PER_DAY,
  toManila,
  weeklyHoursIssues,
  type HoursIssue,
  type HoursIssueCode,
} from '@paw/domain';
import { and, asc, eq, gte } from 'drizzle-orm';
import { z } from 'zod';
import { diffFields, recordAudit, type Tx } from '../audit.ts';
import { httpError } from '../errors.ts';
import { assertEmergencyFlags, branchNotFound } from './branches.ts';
import { BUSINESS_TYPES, emptyToNull } from './businesses.ts';

const { business, branch, branchHours, branchHoursException } = schema;

const HOURS_CONFIRMED_BY = schema.hoursConfirmedBy.enumValues;

/** How far ahead an exception can be set. Further than a year is almost always a typo. */
const MAX_DAYS_AHEAD = 366;

// ── Input schemas ───────────────────────────────────────────────────────────────────────

const TimeSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Enter a time like 08:30 (24-hour clock).');

const IntervalSchema = z.object({ opensAt: TimeSchema, closesAt: TimeSchema });

const ISSUE_MESSAGES = {
  invalid_time: 'Enter a time like 08:30 (24-hour clock).',
  empty:
    'Opening and closing times are the same. For a branch that never closes, use "Open 24 hours".',
  overlap:
    'Overlaps another interval. An interval that closes after midnight runs into the next morning.',
  too_many: `At most ${String(MAX_INTERVALS_PER_DAY)} intervals per day.`,
} as const satisfies Record<HoursIssueCode, string>;

/**
 * Turns the domain's checks into Zod issues at /<list>/<index>/<field>. Malformed times are
 * left out: TimeSchema already reported them (Zod runs this refinement even then).
 */
function addIssues(ctx: z.RefinementCtx, list: string, issues: readonly HoursIssue[]) {
  for (const { index, field, code } of issues) {
    if (code === 'invalid_time') continue;
    ctx.addIssue({
      code: 'custom',
      message: ISSUE_MESSAGES[code],
      path: field === null ? [list, index] : [list, index, field],
    });
  }
}

/** The whole weekly schedule; it replaces the current one. */
export const ReplaceHoursSchema = z
  .object({
    /** Open around the clock (vet-only). Exceptions still apply; the weekly list is kept but unused. */
    is24h: z.boolean(),
    weekly: z
      .array(IntervalSchema.extend({ dayOfWeek: z.int().min(1).max(7) }))
      .max(7 * MAX_INTERVALS_PER_DAY),
  })
  .superRefine((value, ctx) => {
    addIssues(ctx, 'weekly', weeklyHoursIssues(value.weekly));
  });

/** Different hours on one date. Closed means no intervals; open means at least one. */
export const SetHoursExceptionSchema = z
  .object({
    isClosed: z.boolean(),
    intervals: z.array(IntervalSchema).max(MAX_INTERVALS_PER_DAY),
    /** Shown to owners, e.g. "Closed for All Saints' Day". */
    note: z.string().trim().max(200).nullable().default(null),
  })
  .superRefine((value, ctx) => {
    if (value.isClosed && value.intervals.length > 0) {
      ctx.addIssue({ code: 'custom', message: 'A closed day has no hours.', path: ['intervals'] });
    }
    if (!value.isClosed && value.intervals.length === 0) {
      ctx.addIssue({
        code: 'custom',
        message: 'Add the special hours, or mark the day closed.',
        path: ['intervals'],
      });
    }
    addIssues(ctx, 'intervals', dayIntervalsIssues(value.intervals));
  });

export const ExceptionParamsSchema = z.object({ id: z.uuid(), date: z.iso.date() });

type ReplaceHoursInput = z.infer<typeof ReplaceHoursSchema>;
type SetHoursExceptionInput = z.infer<typeof SetHoursExceptionSchema>;

// ── Response schema ─────────────────────────────────────────────────────────────────────

const IntervalResponseSchema = z.object({ opensAt: z.string(), closesAt: z.string() });

export const BranchHoursSchema = z.object({
  branchId: z.uuid(),
  businessType: z.enum(BUSINESS_TYPES),
  /** Today's date in Manila, by the server's clock: exceptions start here. */
  today: z.iso.date(),
  is24h: z.boolean(),
  /** Sorted by day, then opening time. Times are "HH:MM". */
  weekly: z.array(IntervalResponseSchema.extend({ dayOfWeek: z.int() })),
  /** Today and later, by date. Past exceptions stay in the database as history. */
  exceptions: z.array(
    z.object({
      date: z.iso.date(),
      isClosed: z.boolean(),
      intervals: z.array(IntervalResponseSchema),
      note: z.string().nullable(),
    }),
  ),
  hoursConfirmedAt: z.iso.datetime().nullable(),
  hoursConfirmedBy: z.enum(HOURS_CONFIRMED_BY).nullable(),
});

export type BranchHoursResponse = z.infer<typeof BranchHoursSchema>;

// ── Helpers ─────────────────────────────────────────────────────────────────────────────

/** Postgres returns `time` as "HH:MM:SS"; the API speaks "HH:MM". */
const hhmm = (time: string) => time.slice(0, 5);

const manilaToday = () => toManila(new Date()).date;

interface WeeklyRow {
  dayOfWeek: number;
  opensAt: string;
  closesAt: string;
}

const byDayThenTime = (a: WeeklyRow, b: WeeklyRow) =>
  a.dayOfWeek - b.dayOfWeek || a.opensAt.localeCompare(b.opensAt);

async function weeklyRows(db: Pick<Db, 'select'>, branchId: string): Promise<WeeklyRow[]> {
  const rows = await db
    .select({
      dayOfWeek: branchHours.dayOfWeek,
      opensAt: branchHours.opensAt,
      closesAt: branchHours.closesAt,
    })
    .from(branchHours)
    .where(eq(branchHours.branchId, branchId))
    .orderBy(asc(branchHours.dayOfWeek), asc(branchHours.opensAt));
  return rows.map((row) => ({ ...row, opensAt: hhmm(row.opensAt), closesAt: hhmm(row.closesAt) }));
}

/** Locks the branch row (a concurrent save waits, so audit "from" values are accurate). */
async function lockBranch(tx: Tx, branchId: string) {
  const [row] = await tx
    .select({ branch, businessType: business.type })
    .from(branch)
    .innerJoin(business, eq(business.id, branch.businessId))
    .where(eq(branch.id, branchId))
    .for('update', { of: branch });
  if (row === undefined) throw branchNotFound();
  return row;
}

/** Exceptions can be set or removed from today (Manila) up to a year ahead, never in the past. */
function assertEditableDate(date: string, today: string): void {
  if (date < today) {
    const message = 'This date has passed. Past exceptions are kept as history.';
    throw httpError(400, message, [{ pointer: '/date', message }]);
  }
  if (date > addDays(today, MAX_DAYS_AHEAD)) {
    const message = 'Pick a date within the next year.';
    throw httpError(400, message, [{ pointer: '/date', message }]);
  }
}

// ── Queries ─────────────────────────────────────────────────────────────────────────────

/** Takes the database or a transaction (writes read their result back inside theirs). */
export async function getBranchHours(
  db: Pick<Db, 'select'>,
  branchId: string,
): Promise<BranchHoursResponse> {
  const [row] = await db
    .select({ branch, businessType: business.type })
    .from(branch)
    .innerJoin(business, eq(business.id, branch.businessId))
    .where(eq(branch.id, branchId));
  if (row === undefined) throw branchNotFound();

  const today = manilaToday();
  const [weekly, exceptions] = await Promise.all([
    weeklyRows(db, branchId),
    db
      .select()
      .from(branchHoursException)
      .where(
        and(eq(branchHoursException.branchId, branchId), gte(branchHoursException.date, today)),
      )
      .orderBy(asc(branchHoursException.date)),
  ]);

  return {
    branchId,
    businessType: row.businessType,
    today,
    is24h: row.branch.is24h,
    weekly,
    exceptions: exceptions.map(({ date, isClosed, intervals, note }) => ({
      date,
      isClosed,
      intervals,
      note,
    })),
    hoursConfirmedAt: row.branch.hoursConfirmedAt?.toISOString() ?? null,
    hoursConfirmedBy: row.branch.hoursConfirmedBy,
  };
}

// ── Writes (each one records an audit_log entry in the same transaction) ────────────────

export async function replaceWeeklyHours(
  db: Db,
  actorId: string,
  branchId: string,
  input: ReplaceHoursInput,
): Promise<BranchHoursResponse> {
  return db.transaction(async (tx) => {
    const { branch: before, businessType } = await lockBranch(tx, branchId);
    assertEmergencyFlags(businessType, { is24h: input.is24h });

    const weekly = input.weekly
      .map(({ dayOfWeek, opensAt, closesAt }) => ({ dayOfWeek, opensAt, closesAt }))
      .sort(byDayThenTime);
    const diff = diffFields(
      { is24h: before.is24h, weeklyHours: await weeklyRows(tx, branchId) },
      { is24h: input.is24h, weeklyHours: weekly },
      ['is24h', 'weeklyHours'],
    );
    if (Object.keys(diff).length === 0) return getBranchHours(tx, branchId);

    await tx.delete(branchHours).where(eq(branchHours.branchId, branchId));
    if (weekly.length > 0) {
      await tx.insert(branchHours).values(weekly.map((row) => ({ ...row, branchId })));
    }
    // Always touch updated_at: the branch's public page changes with its hours.
    await tx
      .update(branch)
      .set({ is24h: input.is24h, updatedAt: new Date() })
      .where(eq(branch.id, branchId));

    await recordAudit(tx, {
      actorId,
      action: 'branch.update_hours',
      entityType: 'branch',
      entityId: branchId,
      diff,
    });
    return getBranchHours(tx, branchId);
  });
}

export async function setHoursException(
  db: Db,
  actorId: string,
  branchId: string,
  date: string,
  input: SetHoursExceptionInput,
): Promise<BranchHoursResponse> {
  return db.transaction(async (tx) => {
    await lockBranch(tx, branchId);
    assertEditableDate(date, manilaToday());

    const [existing] = await tx
      .select()
      .from(branchHoursException)
      .where(and(eq(branchHoursException.branchId, branchId), eq(branchHoursException.date, date)));
    const values = {
      isClosed: input.isClosed,
      intervals: input.intervals.map(({ opensAt, closesAt }) => ({ opensAt, closesAt })),
      note: emptyToNull(input.note),
    };
    const diff = diffFields(
      {
        hoursException:
          existing === undefined
            ? null
            : {
                date,
                isClosed: existing.isClosed,
                intervals: existing.intervals,
                note: existing.note,
              },
      },
      { hoursException: { date, ...values } },
      ['hoursException'],
    );
    if (Object.keys(diff).length === 0) return getBranchHours(tx, branchId);

    await tx
      .insert(branchHoursException)
      .values({ branchId, date, ...values })
      .onConflictDoUpdate({
        target: [branchHoursException.branchId, branchHoursException.date],
        set: { ...values, updatedAt: new Date() },
      });
    await tx.update(branch).set({ updatedAt: new Date() }).where(eq(branch.id, branchId));

    await recordAudit(tx, {
      actorId,
      action: 'branch.set_hours_exception',
      entityType: 'branch',
      entityId: branchId,
      diff,
    });
    return getBranchHours(tx, branchId);
  });
}

export async function deleteHoursException(
  db: Db,
  actorId: string,
  branchId: string,
  date: string,
): Promise<BranchHoursResponse> {
  return db.transaction(async (tx) => {
    await lockBranch(tx, branchId);
    assertEditableDate(date, manilaToday());

    const [deleted] = await tx
      .delete(branchHoursException)
      .where(and(eq(branchHoursException.branchId, branchId), eq(branchHoursException.date, date)))
      .returning();
    if (deleted === undefined) throw httpError(404, 'This branch has no exception on that date.');
    await tx.update(branch).set({ updatedAt: new Date() }).where(eq(branch.id, branchId));

    await recordAudit(tx, {
      actorId,
      action: 'branch.delete_hours_exception',
      entityType: 'branch',
      entityId: branchId,
      diff: {
        hoursException: {
          from: {
            date,
            isClosed: deleted.isClosed,
            intervals: deleted.intervals,
            note: deleted.note,
          },
          to: null,
        },
      },
    });
    return getBranchHours(tx, branchId);
  });
}

/**
 * PAW ops confirms the hours are still right ("Confirmed today by PAW", UX5). Saving hours
 * never does this by itself: data copied from a Facebook page isn't a confirmation (D35).
 */
export async function confirmHours(
  db: Db,
  actorId: string,
  branchId: string,
): Promise<BranchHoursResponse> {
  return db.transaction(async (tx) => {
    const { branch: before } = await lockBranch(tx, branchId);
    const weekly = await weeklyRows(tx, branchId);
    if (!hasHoursData({ is24h: before.is24h, weekly, exceptions: [] })) {
      throw httpError(400, 'Enter the weekly hours (or mark the branch open 24 hours) first.');
    }

    const now = new Date();
    await tx
      .update(branch)
      .set({ hoursConfirmedAt: now, hoursConfirmedBy: 'paw_ops' })
      .where(eq(branch.id, branchId));

    await recordAudit(tx, {
      actorId,
      action: 'branch.confirm_hours',
      entityType: 'branch',
      entityId: branchId,
      diff: diffFields(
        { hoursConfirmedAt: before.hoursConfirmedAt, hoursConfirmedBy: before.hoursConfirmedBy },
        { hoursConfirmedAt: now, hoursConfirmedBy: 'paw_ops' as const },
        ['hoursConfirmedAt', 'hoursConfirmedBy'],
      ),
    });
    return getBranchHours(tx, branchId);
  });
}

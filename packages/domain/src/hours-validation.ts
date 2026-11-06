// Checks for hours as entered in an hours editor (DESIGN UX13). The API rejects what these
// flag, and the editor runs the same checks to show errors before saving.
import type { HoursInterval, WeeklyInterval } from './hours.ts';
import { MINUTES_PER_DAY } from './local-time.ts';

/** More than this many intervals on one day is almost certainly a typo. */
export const MAX_INTERVALS_PER_DAY = 4;

const MINUTES_PER_WEEK = 7 * MINUTES_PER_DAY;

/**
 * Why an interval was rejected. Codes, not sentences: the API and the web app each word
 * them in their own messages.
 * - invalid_time: not a "HH:MM" time.
 * - empty: opens and closes at the same time (24 hours is a branch flag, not an interval).
 * - overlap: starts while an earlier interval is still open (an overnight interval counts
 *   until it closes the next morning).
 * - too_many: more than MAX_INTERVALS_PER_DAY on its day.
 */
export type HoursIssueCode = 'invalid_time' | 'empty' | 'overlap' | 'too_many';

export interface HoursIssue {
  /** Position of the interval in the list that was checked. */
  index: number;
  /** The field to blame; null for the interval as a whole. */
  field: 'opensAt' | 'closesAt' | null;
  code: HoursIssueCode;
}

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** "HH:MM" → minutes since midnight, or null. */
function minutesOf(time: string): number | null {
  const match = TIME_PATTERN.exec(time);
  return match === null ? null : Number(match[1]) * 60 + Number(match[2]);
}

interface Span {
  index: number;
  start: number;
  end: number;
}

/**
 * The shared checks. `dayOf` places each interval on a day (0-based); `wrap` is the length
 * of the cycle when the last day runs into the first (a week), or null for a single date.
 */
function check(
  intervals: readonly HoursInterval[],
  dayOf: (index: number) => number,
  wrap: number | null,
): HoursIssue[] {
  const issues: HoursIssue[] = [];
  const spans: Span[] = [];
  const perDay = new Map<number, number>();

  intervals.forEach((interval, index) => {
    const day = dayOf(index);
    const count = (perDay.get(day) ?? 0) + 1;
    perDay.set(day, count);
    if (count > MAX_INTERVALS_PER_DAY) {
      issues.push({ index, field: null, code: 'too_many' });
      return;
    }

    const opens = minutesOf(interval.opensAt);
    const closes = minutesOf(interval.closesAt);
    if (opens === null) issues.push({ index, field: 'opensAt', code: 'invalid_time' });
    if (closes === null) issues.push({ index, field: 'closesAt', code: 'invalid_time' });
    if (opens === null || closes === null) return;
    if (opens === closes) {
      issues.push({ index, field: 'closesAt', code: 'empty' });
      return;
    }
    // An interval belongs to the day it starts; closing "earlier" means the next morning.
    const start = day * MINUTES_PER_DAY + opens;
    const length = closes > opens ? closes - opens : closes + MINUTES_PER_DAY - opens;
    spans.push({ index, start, end: start + length });
  });

  // Earlier starts first; on a tie, the interval listed first is the one kept.
  spans.sort((a, b) => a.start - b.start || a.index - b.index);
  const overlapping = new Set<number>();
  for (const [i, span] of spans.entries()) {
    if (spans.slice(0, i).some((earlier) => span.start < earlier.end)) {
      overlapping.add(span.index);
    }
    // Sunday night running into Monday morning: an interval that ends past the cycle also
    // covers the start of the cycle.
    if (wrap !== null && spans.some((other) => other.end > wrap && span.start < other.end - wrap)) {
      overlapping.add(span.index);
    }
  }
  for (const index of [...overlapping].sort((a, b) => a - b)) {
    issues.push({ index, field: 'opensAt', code: 'overlap' });
  }

  return issues.sort((a, b) => a.index - b.index);
}

/** Problems with a branch's weekly hours (empty when they can be saved). */
export function weeklyHoursIssues(intervals: readonly WeeklyInterval[]): HoursIssue[] {
  return check(intervals, (index) => (intervals[index]?.dayOfWeek ?? 1) - 1, MINUTES_PER_WEEK);
}

/** Problems with the intervals of one exception date. */
export function dayIntervalsIssues(intervals: readonly HoursInterval[]): HoursIssue[] {
  return check(intervals, () => 0, null);
}

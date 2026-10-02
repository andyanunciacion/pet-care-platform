// Opening hours: is a branch open now, when does it close, when does it open next
// (DESIGN UX4, UX17). Pure functions: the caller passes the hours and the current instant.
import {
  addDays,
  formatTime,
  isoWeekday,
  MINUTES_PER_DAY,
  parseTime,
  toManila,
} from './local-time.ts';

/** An opening interval in Manila wall-clock time. closesAt earlier than opensAt runs past midnight. */
export interface HoursInterval {
  /** "HH:MM" or "HH:MM:SS". */
  opensAt: string;
  closesAt: string;
}

/** A weekly interval (a branch_hours row). */
export interface WeeklyInterval extends HoursInterval {
  /** ISO weekday: 1 = Monday … 7 = Sunday. */
  dayOfWeek: number;
}

/** Different hours on one date (a branch_hours_exception row). */
export interface HoursException {
  /** "YYYY-MM-DD". */
  date: string;
  isClosed: boolean;
  intervals: readonly HoursInterval[];
  note?: string | null;
}

export interface BranchHours {
  is24h: boolean;
  weekly: readonly WeeklyInterval[];
  exceptions: readonly HoursException[];
}

/** A point in time relative to "now", for display ("closes 6 PM", "opens 8 AM tomorrow"). */
export interface LocalMoment {
  /** Manila date, "YYYY-MM-DD". */
  date: string;
  /** Manila time, "HH:MM". "00:00" with daysFromToday ≥ 1 can mean midnight at the end of the previous day. */
  time: string;
  /** 0 = today, 1 = tomorrow, … */
  daysFromToday: number;
}

/** The states of DESIGN UX4 / UX17. Wording and formatting are left to the UI. */
export type OpenStatus =
  | { state: 'open'; closesAt: LocalMoment }
  | { state: 'closing_soon'; closesAt: LocalMoment; minutesLeft: number }
  | { state: 'open_24h' }
  | { state: 'closed'; opensAt: LocalMoment | null }
  /** A date exception closes the branch today, e.g. a holiday. */
  | { state: 'closed_today'; note: string | null; opensAt: LocalMoment | null }
  /** No hours data and nothing set for today (UX17): "Hours unknown — call ahead". Never counts as open. */
  | { state: 'unknown' };

/** "Closing soon" starts this many minutes before closing (UX4). */
export const CLOSING_SOON_MINUTES = 60;

/** How far ahead nextOpening looks; a branch closed longer than this has no next opening. */
export const LOOKAHEAD_DAYS = 7;

/** A continuous open period, in minutes from today's midnight (end exclusive). */
interface Period {
  start: number;
  end: number;
}

/** True when a branch has regular hours (weekly or 24h). Without them its status is "unknown" (UX17), except on dates with an exception. */
export function hasHoursData(hours: BranchHours): boolean {
  return hours.is24h || hours.weekly.length > 0;
}

function exceptionOn(hours: BranchHours, date: string): HoursException | undefined {
  return hours.exceptions.find((exception) => exception.date === date);
}

/**
 * True when today's status can be computed: the branch has hours, or today has an exception.
 * An explicit "closed today" (or special hours today) is real information even for a branch
 * whose regular hours are unknown, so it wins over "Hours unknown".
 */
function knowsToday(hours: BranchHours, today: string): boolean {
  return hasHoursData(hours) || exceptionOn(hours, today) !== undefined;
}

/**
 * The intervals that start on a date, as [start, end) minutes from that date's midnight.
 * An exception replaces the date's weekly hours (and the 24h flag). An interval belongs to
 * the day it starts, so an overnight interval from the day before still runs into this date.
 */
function intervalsStartingOn(hours: BranchHours, date: string): Period[] {
  const exception = exceptionOn(hours, date);
  if (exception === undefined && hours.is24h) return [{ start: 0, end: MINUTES_PER_DAY }];

  const intervals =
    exception === undefined
      ? hours.weekly.filter((interval) => interval.dayOfWeek === isoWeekday(date))
      : exception.isClosed
        ? []
        : exception.intervals;

  return intervals.flatMap((interval) => {
    const opens = parseTime(interval.opensAt);
    const closes = parseTime(interval.closesAt);
    if (opens === closes) return []; // empty: the database rejects these for weekly hours
    return [{ start: opens, end: closes > opens ? closes : closes + MINUTES_PER_DAY }];
  });
}

/**
 * Open periods from yesterday through LOOKAHEAD_DAYS ahead, in minutes from today's
 * midnight, sorted and merged: touching or overlapping intervals (12:00–13:00 then
 * 13:00–17:00, or 24h days in a row) form one period, so "closes at" is the real closing.
 */
function openPeriods(hours: BranchHours, today: string): Period[] {
  const periods: Period[] = [];
  for (let day = -1; day <= LOOKAHEAD_DAYS; day++) {
    const offset = day * MINUTES_PER_DAY;
    for (const { start, end } of intervalsStartingOn(hours, addDays(today, day))) {
      periods.push({ start: start + offset, end: end + offset });
    }
  }
  periods.sort((a, b) => a.start - b.start);

  const merged: Period[] = [];
  for (const period of periods) {
    const last = merged.at(-1);
    if (last !== undefined && period.start <= last.end) {
      last.end = Math.max(last.end, period.end);
    } else {
      merged.push({ ...period });
    }
  }
  return merged;
}

function momentAt(today: string, minutesFromToday: number): LocalMoment {
  const daysFromToday = Math.floor(minutesFromToday / MINUTES_PER_DAY);
  return {
    date: addDays(today, daysFromToday),
    time: formatTime(minutesFromToday),
    daysFromToday,
  };
}

/** The branch's open status at an instant (DESIGN UX4, UX17). */
export function openStatus(hours: BranchHours, now: Date): OpenStatus {
  const { date: today, minutes } = toManila(now);
  if (!knowsToday(hours, today)) return { state: 'unknown' };

  const periods = openPeriods(hours, today);
  const current = periods.find((period) => period.start <= minutes && minutes < period.end);

  if (current !== undefined) {
    const minutesLeft = current.end - minutes;
    const closesAt = momentAt(today, current.end);
    if (minutesLeft <= CLOSING_SOON_MINUTES)
      return { state: 'closing_soon', closesAt, minutesLeft };
    // Open around the clock: a 24h branch on a normal day, or a period that outlasts the lookahead.
    const fullDayToday = hours.is24h && exceptionOn(hours, today) === undefined;
    if (fullDayToday || current.end > LOOKAHEAD_DAYS * MINUTES_PER_DAY)
      return { state: 'open_24h' };
    return { state: 'open', closesAt };
  }

  const next = periods.find((period) => period.start > minutes);
  const opensAt = next === undefined ? null : momentAt(today, next.start);
  const todayException = exceptionOn(hours, today);
  if (todayException?.isClosed === true) {
    return { state: 'closed_today', note: todayException.note ?? null, opensAt };
  }
  return { state: 'closed', opensAt };
}

/** True if the branch is open at the instant. "Hours unknown" is never open (UX17). */
export function isOpenNow(hours: BranchHours, now: Date): boolean {
  const { state } = openStatus(hours, now);
  return state === 'open' || state === 'closing_soon' || state === 'open_24h';
}

/** When the current open period ends; null if closed, unknown, or open around the clock. */
export function closesAt(hours: BranchHours, now: Date): LocalMoment | null {
  const status = openStatus(hours, now);
  return status.state === 'open' || status.state === 'closing_soon' ? status.closesAt : null;
}

/**
 * The next time the branch opens after the instant, within LOOKAHEAD_DAYS (if it's open
 * now, the opening after the current period ends). Null if none, or if hours are unknown.
 */
export function nextOpening(hours: BranchHours, now: Date): LocalMoment | null {
  const { date: today, minutes } = toManila(now);
  if (!knowsToday(hours, today)) return null;
  const next = openPeriods(hours, today).find((period) => period.start > minutes);
  return next === undefined ? null : momentAt(today, next.start);
}

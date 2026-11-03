// Wall-clock dates and times in the Philippines.
//
// Business hours are wall-clock times in Asia/Manila (CLAUDE.md). The Philippines has had
// no daylight saving time since 1978, so a Manila day is always 24 hours long and minute
// arithmetic on wall-clock times matches real elapsed time. Only the conversion from an
// instant (a Date) to Manila wall-clock time needs the time zone; Intl does it, in Node
// and in browsers alike, without a date library.

export const TIME_ZONE = 'Asia/Manila';

export const MINUTES_PER_DAY = 24 * 60;

/** A Manila calendar date ("2026-12-25") and the minutes since its midnight (0–1439). */
export interface LocalDateTime {
  date: string;
  minutes: number;
}

const manilaParts = new Intl.DateTimeFormat('en-US', {
  timeZone: TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

/** The Manila wall-clock date and time of an instant. */
export function toManila(instant: Date): LocalDateTime {
  const parts = Object.fromEntries(
    manilaParts.formatToParts(instant).map((part) => [part.type, part.value]),
  );
  return {
    date: `${parts.year ?? ''}-${parts.month ?? ''}-${parts.day ?? ''}`,
    minutes: Number(parts.hour) * 60 + Number(parts.minute),
  };
}

/** Parses "YYYY-MM-DD" as a UTC midnight, only for calendar arithmetic. */
function calendarDate(date: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error(`Invalid date "${date}"`);
  const parsed = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) {
    throw new Error(`Invalid date "${date}"`);
  }
  return parsed;
}

export function addDays(date: string, days: number): string {
  const result = calendarDate(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result.toISOString().slice(0, 10);
}

/** Whole calendar days from `from` to `to` (negative if `to` is earlier). */
export function daysBetween(from: string, to: string): number {
  return Math.round(
    (calendarDate(to).getTime() - calendarDate(from).getTime()) / (MINUTES_PER_DAY * 60_000),
  );
}

/** ISO weekday: 1 = Monday … 7 = Sunday (same numbering as branch_hours.day_of_week). */
export function isoWeekday(date: string): number {
  const day = calendarDate(date).getUTCDay(); // 0 = Sunday
  return day === 0 ? 7 : day;
}

/** "08:30" or "08:30:00" (as Postgres returns `time` columns) → minutes since midnight. */
export function parseTime(time: string): number {
  const match = /^([01]\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?$/.exec(time);
  if (match === null) throw new Error(`Invalid time "${time}"`);
  return Number(match[1]) * 60 + Number(match[2]);
}

/** Minutes since midnight → "HH:MM" (1440, midnight at the end of the day, → "00:00"). */
export function formatTime(minutes: number): string {
  const wrapped = ((minutes % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  const hours = Math.floor(wrapped / 60);
  return `${String(hours).padStart(2, '0')}:${String(wrapped % 60).padStart(2, '0')}`;
}

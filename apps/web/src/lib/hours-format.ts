// Display helpers for opening hours, shared by the admin editor and (P1-4) the public page.
// Hours are Manila wall-clock times ("13:30") and dates are calendar dates ("2026-12-25"),
// not instants, so they are formatted in UTC on a synthetic date: the time zone of the
// server or browser can't shift them.

import type { HoursInterval, WeeklyInterval } from '@paw/domain';

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?$/;

function parts(time: string): { hours: number; minutes: number } | null {
  const match = TIME_PATTERN.exec(time);
  return match === null ? null : { hours: Number(match[1]), minutes: Number(match[2]) };
}

/** True when the time is a complete "HH:MM" (an `<input type="time">` gives "" until it is). */
export function isCompleteTime(time: string): boolean {
  return parts(time) !== null;
}

/** "13:30" → "1:30 PM", "08:00" → "8 AM" (minutes only when there are some). */
export function wallTimeLabel(time: string, locale: string): string {
  const parsed = parts(time);
  if (parsed === null) return time;
  return new Intl.DateTimeFormat(locale, {
    hour: 'numeric',
    ...(parsed.minutes !== 0 && { minute: '2-digit' }),
    timeZone: 'UTC',
  }).format(Date.UTC(2000, 0, 1, parsed.hours, parsed.minutes));
}

/** "8 AM – 12 PM". */
export function intervalLabel(interval: HoursInterval, locale: string): string {
  return `${wallTimeLabel(interval.opensAt, locale)} – ${wallTimeLabel(interval.closesAt, locale)}`;
}

/** Closes after midnight: it belongs to the day it opens (ARCHITECTURE D28). */
export function isOvernight(interval: HoursInterval): boolean {
  const opens = parts(interval.opensAt);
  const closes = parts(interval.closesAt);
  if (opens === null || closes === null) return false;
  return closes.hours * 60 + closes.minutes < opens.hours * 60 + opens.minutes;
}

/** ISO weekday (1 = Monday … 7 = Sunday) → "Mon" / "Monday". */
export function weekdayLabel(dayOfWeek: number, locale: string, width: 'short' | 'long'): string {
  // 2024-01-01 was a Monday.
  return new Intl.DateTimeFormat(locale, { weekday: width, timeZone: 'UTC' }).format(
    Date.UTC(2024, 0, dayOfWeek),
  );
}

/** "2026-12-25" → "Fri, Dec 25" (with the year when it isn't `currentYear`). */
export function dateLabel(date: string, locale: string, currentYear?: number): string {
  const [year, month, day] = date.split('-').map(Number);
  if (year === undefined || month === undefined || day === undefined) return date;
  return new Intl.DateTimeFormat(locale, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    ...(year !== currentYear && { year: 'numeric' }),
    timeZone: 'UTC',
  }).format(Date.UTC(year, month - 1, day));
}

/** The weekly intervals grouped by ISO weekday (1–7), each day sorted by opening time. */
export function intervalsByDay(weekly: readonly WeeklyInterval[]): Map<number, HoursInterval[]> {
  const days = new Map<number, HoursInterval[]>();
  for (let day = 1; day <= 7; day++) days.set(day, []);
  for (const { dayOfWeek, opensAt, closesAt } of weekly) {
    days.get(dayOfWeek)?.push({ opensAt, closesAt });
  }
  for (const intervals of days.values()) {
    intervals.sort((a, b) => a.opensAt.localeCompare(b.opensAt));
  }
  return days;
}

// Reads one day's hours as people write them in a spreadsheet (the CSV import, P1-2e):
// "8am-5pm", "8:00-12:00, 13:00-17:00", "8:30am-12nn 1pm-5pm", "closed". Only the format
// is checked here; overlaps and empty intervals are weeklyHoursIssues' job.
import type { HoursInterval } from './hours.ts';

/**
 * Why a day's text was rejected. Codes, not sentences: the API words them.
 * - unreadable: a part isn't a time range like "8am-5pm" or "08:00-17:00".
 * - ambiguous: no am/pm, both hours 12 or less, and it either closes "before" it opens
 *   ("8-5": almost always 8am-5pm, not overnight until 5am) or opens before 6:00 ("1-5":
 *   almost always 1pm-5pm). "08:00-17:00", "8am-5pm" and "1am-5am" are fine.
 * - all_day: "24 hours" belongs in the branch's 24-hour flag, not in a day.
 */
export type DayHoursTextIssue = 'unreadable' | 'ambiguous' | 'all_day';

export type DayHoursText =
  | { kind: 'blank' }
  | { kind: 'closed' }
  | { kind: 'open'; intervals: HoursInterval[] }
  | { kind: 'invalid'; issue: DayHoursTextIssue; part: string };

/** An unmarked opening time before this (in minutes) is read as afternoon shorthand. */
const EARLIEST_UNMARKED_OPENING = 6 * 60;

const CLOSED = new Set(['closed', 'close', 'sarado']);
const ALL_DAY = /^(open\s*)?24\s*(h|hrs?|hours?)$|^24\/7$/;

// After normalizing: "8", "8:30", "08:00", "8am", "8:30pm", "12nn", "12mn", "noon", "midnight".
const TIME = /^(?:(\d{1,2})(?::(\d{2}))?(am|pm|nn|mn)?|(noon|midnight))$/;

interface ParsedTime {
  minutes: number;
  /** Written with am/pm/nn/mn/noon/midnight, so it can't be misread. */
  marked: boolean;
  /** The hour as written, for the "8-5" check. */
  writtenHour: number;
}

function parseTime(text: string): ParsedTime | null {
  const match = TIME.exec(text);
  if (match === null) return null;
  const [, hourText, minuteText, suffix, word] = match;
  if (word === 'noon') return { minutes: 12 * 60, marked: true, writtenHour: 12 };
  if (word === 'midnight') return { minutes: 0, marked: true, writtenHour: 12 };

  const hour = Number(hourText);
  const minute = minuteText === undefined ? 0 : Number(minuteText);
  if (minute > 59) return null;

  if (suffix === undefined) {
    // 24-hour clock. "24:00" is accepted as a closing time and means midnight.
    if (hour === 24 && minute === 0) return { minutes: 0, marked: false, writtenHour: 24 };
    if (hour > 23) return null;
    return { minutes: hour * 60 + minute, marked: false, writtenHour: hour };
  }
  if (hour < 1 || hour > 12) return null;
  // "12nn" is noon and "12mn" midnight (common in PH); any other hour with them is a typo.
  if ((suffix === 'nn' || suffix === 'mn') && hour !== 12) return null;
  const hour24 =
    suffix === 'nn' ? 12 : suffix === 'mn' ? 0 : (hour % 12) + (suffix === 'pm' ? 12 : 0);
  return { minutes: hour24 * 60 + minute, marked: true, writtenHour: hour };
}

function hhmm(minutes: number): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
}

/** One day's hours as written in a spreadsheet cell → intervals ("HH:MM"), closed or blank. */
export function parseDayHours(text: string): DayHoursText {
  const lower = text.trim().toLowerCase();
  if (lower === '') return { kind: 'blank' };
  if (CLOSED.has(lower)) return { kind: 'closed' };
  if (ALL_DAY.test(lower)) return { kind: 'invalid', issue: 'all_day', part: text.trim() };

  const normalized = lower
    .replace(/a\.m\.?/g, 'am')
    .replace(/p\.m\.?/g, 'pm')
    .replace(/n\.n\.?/g, 'nn')
    .replace(/[–—]/g, '-')
    .replace(/\s+to\s+/g, '-')
    .replace(/\s*-\s*/g, '-')
    .replace(/(\d)\s*noon\b/g, '$1nn')
    .replace(/(\d)\s*midnight\b/g, '$1mn')
    .replace(/(\d)\s+(am|pm|nn|mn)\b/g, '$1$2');
  const parts = normalized.split(/\s*(?:,|;|\/|&|\band\b|\s)\s*/).filter((part) => part !== '');

  const intervals: HoursInterval[] = [];
  for (const part of parts) {
    const [opensText, closesText, ...rest] = part.split('-');
    const opens = opensText === undefined ? null : parseTime(opensText);
    const closes = closesText === undefined ? null : parseTime(closesText);
    if (rest.length > 0 || opens === null || closes === null) {
      return { kind: 'invalid', issue: 'unreadable', part };
    }
    if (
      !opens.marked &&
      !closes.marked &&
      opens.writtenHour <= 12 &&
      closes.writtenHour <= 12 &&
      (closes.minutes < opens.minutes || opens.minutes < EARLIEST_UNMARKED_OPENING)
    ) {
      return { kind: 'invalid', issue: 'ambiguous', part };
    }
    intervals.push({ opensAt: hhmm(opens.minutes), closesAt: hhmm(closes.minutes) });
  }
  return { kind: 'open', intervals };
}

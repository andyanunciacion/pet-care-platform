import { describe, expect, it } from 'vitest';
import { addDays, daysBetween, formatTime, isoWeekday, parseTime, toManila } from './local-time.ts';

describe('toManila', () => {
  it('converts an instant to Manila wall-clock time (UTC+8, no daylight saving)', () => {
    expect(toManila(new Date('2026-10-05T00:30:00Z'))).toEqual({
      date: '2026-10-05',
      minutes: 510,
    });
    expect(toManila(new Date('2026-12-31T16:00:00Z'))).toEqual({ date: '2027-01-01', minutes: 0 });
    // Mid-year too: Manila never shifts its clocks.
    expect(toManila(new Date('2026-06-15T04:00:00Z'))).toEqual({
      date: '2026-06-15',
      minutes: 720,
    });
  });
});

describe('calendar helpers', () => {
  it('adds days across months, years and leap days', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('counts days between dates', () => {
    expect(daysBetween('2026-10-01', '2026-10-05')).toBe(4);
    expect(daysBetween('2026-10-05', '2026-10-01')).toBe(-4);
  });

  it('numbers weekdays Monday = 1 … Sunday = 7', () => {
    expect(isoWeekday('2026-10-05')).toBe(1);
    expect(isoWeekday('2026-10-11')).toBe(7);
    expect(isoWeekday('2026-12-25')).toBe(5);
  });

  it('rejects invalid dates', () => {
    expect(() => addDays('2026-02-30', 1)).toThrow('Invalid date');
    expect(() => isoWeekday('5 Oct 2026')).toThrow('Invalid date');
  });
});

describe('parseTime / formatTime', () => {
  it('parses HH:MM and HH:MM:SS', () => {
    expect(parseTime('00:00')).toBe(0);
    expect(parseTime('08:30')).toBe(510);
    expect(parseTime('23:59:00')).toBe(1439);
  });

  it('rejects anything else', () => {
    for (const time of ['24:00', '8:30', '08:60', '8am', '']) {
      expect(() => parseTime(time)).toThrow('Invalid time');
    }
  });

  it('formats minutes, wrapping midnight', () => {
    expect(formatTime(510)).toBe('08:30');
    expect(formatTime(1440)).toBe('00:00');
    expect(formatTime(1440 + 120)).toBe('02:00');
  });
});

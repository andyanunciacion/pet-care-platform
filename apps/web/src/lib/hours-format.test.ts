import { describe, expect, it } from 'vitest';
import {
  dateLabel,
  intervalLabel,
  intervalsByDay,
  isCompleteTime,
  isOvernight,
  wallTimeLabel,
  weekdayLabel,
} from './hours-format';

// Intl separates "8" and "AM" with a narrow no-break space; compare with plain spaces.
const plain = (label: string) => label.replace(/\s/g, ' ');

describe('wallTimeLabel', () => {
  it('shows minutes only when there are some', () => {
    expect(plain(wallTimeLabel('08:00', 'en'))).toBe('8 AM');
    expect(plain(wallTimeLabel('13:30', 'en'))).toBe('1:30 PM');
    expect(plain(wallTimeLabel('00:00', 'en'))).toBe('12 AM');
    expect(plain(wallTimeLabel('12:00:00', 'en'))).toBe('12 PM');
  });

  it('leaves an incomplete time as typed', () => {
    expect(wallTimeLabel('', 'en')).toBe('');
    expect(isCompleteTime('')).toBe(false);
    expect(isCompleteTime('08:30')).toBe(true);
  });
});

describe('intervals', () => {
  it('labels an interval and spots overnight ones', () => {
    expect(plain(intervalLabel({ opensAt: '20:00', closesAt: '02:00' }, 'en'))).toBe('8 PM – 2 AM');
    expect(isOvernight({ opensAt: '20:00', closesAt: '02:00' })).toBe(true);
    expect(isOvernight({ opensAt: '08:00', closesAt: '17:00' })).toBe(false);
  });

  it('groups weekly intervals by day, sorted', () => {
    const days = intervalsByDay([
      { dayOfWeek: 1, opensAt: '13:00', closesAt: '17:00' },
      { dayOfWeek: 1, opensAt: '08:00', closesAt: '12:00' },
    ]);
    expect(days.get(1)?.map((i) => i.opensAt)).toEqual(['08:00', '13:00']);
    expect(days.get(7)).toEqual([]);
  });
});

describe('weekdayLabel / dateLabel', () => {
  it('uses ISO weekdays', () => {
    expect(weekdayLabel(1, 'en', 'short')).toBe('Mon');
    expect(weekdayLabel(7, 'en', 'long')).toBe('Sunday');
  });

  it('shows the year only when it is not the current one', () => {
    expect(dateLabel('2026-12-25', 'en', 2026)).toBe('Fri, Dec 25');
    expect(dateLabel('2027-01-01', 'en', 2026)).toBe('Fri, Jan 1, 2027');
  });
});

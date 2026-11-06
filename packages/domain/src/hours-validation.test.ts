import { describe, expect, it } from 'vitest';
import type { WeeklyInterval } from './hours.ts';
import {
  dayIntervalsIssues,
  MAX_INTERVALS_PER_DAY,
  weeklyHoursIssues,
} from './hours-validation.ts';

const at = (dayOfWeek: number, opensAt: string, closesAt: string): WeeklyInterval => ({
  dayOfWeek,
  opensAt,
  closesAt,
});

describe('weeklyHoursIssues', () => {
  it('accepts a lunch break, touching intervals and an overnight shift', () => {
    expect(
      weeklyHoursIssues([
        at(1, '08:00', '12:00'),
        at(1, '13:00', '17:00'),
        at(2, '08:00', '12:00'),
        at(2, '12:00', '17:00'),
        at(3, '20:00', '02:00'),
        at(4, '08:00', '12:00'),
      ]),
    ).toEqual([]);
  });

  it('accepts no hours at all', () => {
    expect(weeklyHoursIssues([])).toEqual([]);
  });

  it('flags the later of two overlapping intervals, whatever the list order', () => {
    expect(weeklyHoursIssues([at(1, '10:00', '14:00'), at(1, '08:00', '12:00')])).toEqual([
      { index: 0, field: 'opensAt', code: 'overlap' },
    ]);
  });

  it('flags an interval inside another', () => {
    expect(weeklyHoursIssues([at(1, '08:00', '17:00'), at(1, '12:00', '13:00')])).toEqual([
      { index: 1, field: 'opensAt', code: 'overlap' },
    ]);
  });

  it('flags the same interval entered twice', () => {
    expect(weeklyHoursIssues([at(1, '08:00', '12:00'), at(1, '08:00', '12:00')])).toEqual([
      { index: 1, field: 'opensAt', code: 'overlap' },
    ]);
  });

  it('flags a morning that starts before the previous night closes', () => {
    expect(weeklyHoursIssues([at(3, '20:00', '02:00'), at(4, '01:00', '09:00')])).toEqual([
      { index: 1, field: 'opensAt', code: 'overlap' },
    ]);
  });

  it('wraps Sunday night into Monday morning', () => {
    expect(weeklyHoursIssues([at(7, '22:00', '03:00'), at(1, '02:00', '10:00')])).toEqual([
      { index: 1, field: 'opensAt', code: 'overlap' },
    ]);
    expect(weeklyHoursIssues([at(7, '22:00', '03:00'), at(1, '03:00', '10:00')])).toEqual([]);
  });

  it('flags empty intervals and malformed times', () => {
    expect(
      weeklyHoursIssues([at(1, '08:00', '08:00'), at(2, '8:00', '12:00'), at(3, '08:00', '24:00')]),
    ).toEqual([
      { index: 0, field: 'closesAt', code: 'empty' },
      { index: 1, field: 'opensAt', code: 'invalid_time' },
      { index: 2, field: 'closesAt', code: 'invalid_time' },
    ]);
  });

  it(`flags more than ${String(MAX_INTERVALS_PER_DAY)} intervals on a day`, () => {
    const day = [
      at(2, '06:00', '07:00'),
      at(2, '08:00', '09:00'),
      at(2, '10:00', '11:00'),
      at(2, '12:00', '13:00'),
      at(2, '14:00', '15:00'),
    ];
    expect(weeklyHoursIssues(day)).toEqual([{ index: 4, field: null, code: 'too_many' }]);
  });
});

describe('dayIntervalsIssues', () => {
  it('accepts special hours with a break', () => {
    expect(
      dayIntervalsIssues([
        { opensAt: '09:00', closesAt: '12:00' },
        { opensAt: '13:00', closesAt: '15:00' },
      ]),
    ).toEqual([]);
  });

  it('flags overlaps within the date', () => {
    expect(
      dayIntervalsIssues([
        { opensAt: '09:00', closesAt: '12:00' },
        { opensAt: '11:00', closesAt: '15:00' },
      ]),
    ).toEqual([{ index: 1, field: 'opensAt', code: 'overlap' }]);
  });
});

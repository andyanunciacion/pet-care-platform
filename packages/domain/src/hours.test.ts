import { describe, expect, it } from 'vitest';
import {
  closesAt,
  isOpenNow,
  nextOpening,
  openStatus,
  type BranchHours,
  type WeeklyInterval,
} from './hours.ts';

/** An instant given as Manila wall-clock time, e.g. manila('2026-10-05 10:00'). */
const manila = (dateTime: string) => new Date(`${dateTime.replace(' ', 'T')}:00+08:00`);

const weekdays = [1, 2, 3, 4, 5];
const every = (days: number[], opensAt: string, closesAt: string): WeeklyInterval[] =>
  days.map((dayOfWeek) => ({ dayOfWeek, opensAt, closesAt }));

/** Mon–Fri 8–12 and 1–5 (lunch break), Sat 9–12, closed Sunday. */
const clinic: BranchHours = {
  is24h: false,
  weekly: [
    ...every(weekdays, '08:00', '12:00'),
    ...every(weekdays, '13:00', '17:00'),
    ...every([6], '09:00', '12:00'),
  ],
  exceptions: [],
};

// Calendar used below: Mon 2026-10-05 … Sun 2026-10-11; Thu 2026-12-24, Fri 2026-12-25.

describe('openStatus: a regular week', () => {
  it('is open, with the closing time', () => {
    expect(openStatus(clinic, manila('2026-10-05 10:00'))).toEqual({
      state: 'open',
      closesAt: { date: '2026-10-05', time: '12:00', daysFromToday: 0 },
    });
  });

  it('is closing soon in the last 60 minutes', () => {
    expect(openStatus(clinic, manila('2026-10-05 11:30'))).toEqual({
      state: 'closing_soon',
      closesAt: { date: '2026-10-05', time: '12:00', daysFromToday: 0 },
      minutesLeft: 30,
    });
    expect(openStatus(clinic, manila('2026-10-05 11:00')).state).toBe('closing_soon');
    expect(openStatus(clinic, manila('2026-10-05 10:59')).state).toBe('open');
  });

  it('is closed over lunch, opening again the same day', () => {
    expect(openStatus(clinic, manila('2026-10-05 12:00'))).toEqual({
      state: 'closed',
      opensAt: { date: '2026-10-05', time: '13:00', daysFromToday: 0 },
    });
  });

  it('is closed in the evening, opening tomorrow', () => {
    expect(openStatus(clinic, manila('2026-10-05 17:30'))).toEqual({
      state: 'closed',
      opensAt: { date: '2026-10-06', time: '08:00', daysFromToday: 1 },
    });
  });

  it('skips closed days when looking for the next opening', () => {
    // Saturday afternoon: closed Sunday, so next is Monday.
    expect(openStatus(clinic, manila('2026-10-10 13:00'))).toEqual({
      state: 'closed',
      opensAt: { date: '2026-10-12', time: '08:00', daysFromToday: 2 },
    });
  });

  it('opens and closes on the minute', () => {
    expect(openStatus(clinic, manila('2026-10-05 07:59')).state).toBe('closed');
    expect(openStatus(clinic, manila('2026-10-05 08:00')).state).toBe('open');
    expect(openStatus(clinic, manila('2026-10-05 16:59')).state).toBe('closing_soon');
    expect(openStatus(clinic, manila('2026-10-05 17:00')).state).toBe('closed');
  });
});

describe('openStatus: joined and overnight intervals', () => {
  it('treats back-to-back intervals as one open period', () => {
    const noBreak: BranchHours = {
      ...clinic,
      weekly: [...every([1], '08:00', '12:00'), ...every([1], '12:00', '17:00')],
    };
    expect(openStatus(noBreak, manila('2026-10-05 11:30'))).toEqual({
      state: 'open',
      closesAt: { date: '2026-10-05', time: '17:00', daysFromToday: 0 },
    });
  });

  // Friday 8 PM – 2 AM.
  const lateFriday: BranchHours = { ...clinic, weekly: every([5], '20:00', '02:00') };

  it('runs an overnight interval past midnight', () => {
    expect(openStatus(lateFriday, manila('2026-10-09 23:00'))).toEqual({
      state: 'open',
      closesAt: { date: '2026-10-10', time: '02:00', daysFromToday: 1 },
    });
  });

  it("is still open after midnight, on the interval's second day", () => {
    expect(openStatus(lateFriday, manila('2026-10-10 01:30'))).toEqual({
      state: 'closing_soon',
      closesAt: { date: '2026-10-10', time: '02:00', daysFromToday: 0 },
      minutesLeft: 30,
    });
    expect(openStatus(lateFriday, manila('2026-10-10 02:00'))).toEqual({
      state: 'closed',
      opensAt: { date: '2026-10-16', time: '20:00', daysFromToday: 6 },
    });
  });

  it('reads a 00:00 closing time as midnight', () => {
    const untilMidnight: BranchHours = { ...clinic, weekly: every([1], '18:00', '00:00') };
    expect(openStatus(untilMidnight, manila('2026-10-05 23:30'))).toEqual({
      state: 'closing_soon',
      closesAt: { date: '2026-10-06', time: '00:00', daysFromToday: 1 },
      minutesLeft: 30,
    });
  });
});

describe('openStatus: date exceptions', () => {
  it('shows "closed today" on a holiday, with its note and the next opening', () => {
    const christmas: BranchHours = {
      ...clinic,
      exceptions: [{ date: '2026-12-25', isClosed: true, intervals: [], note: 'Merry Christmas!' }],
    };
    expect(openStatus(christmas, manila('2026-12-25 10:00'))).toEqual({
      state: 'closed_today',
      note: 'Merry Christmas!',
      opensAt: { date: '2026-12-26', time: '09:00', daysFromToday: 1 },
    });
  });

  it("lets the previous night's overnight interval run into a holiday", () => {
    const nightShift: BranchHours = {
      ...clinic,
      weekly: every([4], '20:00', '02:00'),
      exceptions: [{ date: '2026-12-25', isClosed: true, intervals: [] }],
    };
    // Thursday 24 Dec, 8 PM – 2 AM still runs; Christmas Day itself is closed.
    expect(openStatus(nightShift, manila('2026-12-25 01:00')).state).toBe('closing_soon');
    expect(openStatus(nightShift, manila('2026-12-25 03:00'))).toEqual({
      state: 'closed_today',
      note: null,
      opensAt: { date: '2026-12-31', time: '20:00', daysFromToday: 6 },
    });
  });

  it('replaces the weekly hours with the special hours', () => {
    const christmasEve: BranchHours = {
      ...clinic,
      exceptions: [
        {
          date: '2026-12-24',
          isClosed: false,
          intervals: [{ opensAt: '08:00', closesAt: '11:00' }],
        },
      ],
    };
    expect(openStatus(christmasEve, manila('2026-12-24 09:00'))).toEqual({
      state: 'open',
      closesAt: { date: '2026-12-24', time: '11:00', daysFromToday: 0 },
    });
    // No afternoon interval today, so it doesn't reopen at 1 PM.
    expect(openStatus(christmasEve, manila('2026-12-24 11:30'))).toEqual({
      state: 'closed',
      opensAt: { date: '2026-12-25', time: '08:00', daysFromToday: 1 },
    });
  });

  it('opens on a normally closed day', () => {
    const sundayClinic: BranchHours = {
      ...clinic,
      exceptions: [
        {
          date: '2026-10-11',
          isClosed: false,
          intervals: [{ opensAt: '09:00', closesAt: '15:00' }],
        },
      ],
    };
    expect(openStatus(sundayClinic, manila('2026-10-11 10:00')).state).toBe('open');
  });

  it('has no next opening when closed for longer than the lookahead', () => {
    const renovation: BranchHours = {
      ...clinic,
      exceptions: Array.from({ length: 9 }, (_, day) => ({
        date: `2026-10-${String(5 + day).padStart(2, '0')}`,
        isClosed: true,
        intervals: [],
      })),
    };
    expect(openStatus(renovation, manila('2026-10-05 10:00'))).toEqual({
      state: 'closed_today',
      note: null,
      opensAt: null,
    });
  });
});

describe('openStatus: 24-hour branches', () => {
  const allDay: BranchHours = { is24h: true, weekly: [], exceptions: [] };

  it('is open 24 hours, even just before midnight', () => {
    expect(openStatus(allDay, manila('2026-10-05 03:00'))).toEqual({ state: 'open_24h' });
    expect(openStatus(allDay, manila('2026-10-05 23:30'))).toEqual({ state: 'open_24h' });
  });

  const closedChristmas: BranchHours = {
    ...allDay,
    exceptions: [{ date: '2026-12-25', isClosed: true, intervals: [] }],
  };

  it('counts down to a holiday closure', () => {
    expect(openStatus(closedChristmas, manila('2026-12-24 22:00')).state).toBe('open_24h');
    expect(openStatus(closedChristmas, manila('2026-12-24 23:30'))).toEqual({
      state: 'closing_soon',
      closesAt: { date: '2026-12-25', time: '00:00', daysFromToday: 1 },
      minutesLeft: 30,
    });
  });

  it('is closed on the holiday, reopening at midnight', () => {
    expect(openStatus(closedChristmas, manila('2026-12-25 10:00'))).toEqual({
      state: 'closed_today',
      note: null,
      opensAt: { date: '2026-12-26', time: '00:00', daysFromToday: 1 },
    });
  });

  it('follows reduced hours on an exception date', () => {
    const reduced: BranchHours = {
      ...allDay,
      exceptions: [
        {
          date: '2026-12-31',
          isClosed: false,
          intervals: [{ opensAt: '08:00', closesAt: '18:00' }],
        },
      ],
    };
    expect(openStatus(reduced, manila('2026-12-31 07:00'))).toEqual({
      state: 'closed',
      opensAt: { date: '2026-12-31', time: '08:00', daysFromToday: 0 },
    });
    expect(openStatus(reduced, manila('2026-12-31 12:00'))).toEqual({
      state: 'open',
      closesAt: { date: '2026-12-31', time: '18:00', daysFromToday: 0 },
    });
  });
});

describe('openStatus: no hours data (UX17)', () => {
  const noHours: BranchHours = { is24h: false, weekly: [], exceptions: [] };

  it('is unknown, and never counts as open', () => {
    expect(openStatus(noHours, manila('2026-10-05 10:00'))).toEqual({ state: 'unknown' });
    expect(isOpenNow(noHours, manila('2026-10-05 10:00'))).toBe(false);
    expect(nextOpening(noHours, manila('2026-10-05 10:00'))).toBeNull();
  });

  it('shows "closed today" instead of "unknown" when the clinic marked today closed', () => {
    const sickDay: BranchHours = {
      ...noHours,
      exceptions: [{ date: '2026-10-05', isClosed: true, intervals: [], note: 'Vet is out sick' }],
    };
    expect(openStatus(sickDay, manila('2026-10-05 10:00'))).toEqual({
      state: 'closed_today',
      note: 'Vet is out sick',
      opensAt: null, // regular hours are still unknown
    });
    // Other days stay unknown.
    expect(openStatus(sickDay, manila('2026-10-06 10:00'))).toEqual({ state: 'unknown' });
  });

  it('uses special hours set for today, even without regular hours', () => {
    const specialDay: BranchHours = {
      ...noHours,
      exceptions: [
        {
          date: '2026-10-05',
          isClosed: false,
          intervals: [{ opensAt: '09:00', closesAt: '15:00' }],
        },
      ],
    };
    expect(openStatus(specialDay, manila('2026-10-05 10:00'))).toEqual({
      state: 'open',
      closesAt: { date: '2026-10-05', time: '15:00', daysFromToday: 0 },
    });
    expect(isOpenNow(specialDay, manila('2026-10-05 10:00'))).toBe(true);
    expect(nextOpening(specialDay, manila('2026-10-05 08:00'))).toEqual({
      date: '2026-10-05',
      time: '09:00',
      daysFromToday: 0,
    });
  });
});

describe('time zone', () => {
  it('uses Manila time, not UTC', () => {
    // 00:30 UTC Monday = 08:30 in Manila (UTC+8).
    expect(openStatus(clinic, new Date('2026-10-05T00:30:00Z')).state).toBe('open');
    // 23:30 UTC Sunday is already Monday 07:30 in Manila: closed, opening at 8 today.
    expect(openStatus(clinic, new Date('2026-10-04T23:30:00Z'))).toEqual({
      state: 'closed',
      opensAt: { date: '2026-10-05', time: '08:00', daysFromToday: 0 },
    });
  });

  it('accepts times as Postgres returns them ("HH:MM:SS")', () => {
    const fromDatabase: BranchHours = { ...clinic, weekly: every([1], '08:00:00', '17:00:00') };
    expect(openStatus(fromDatabase, manila('2026-10-05 09:00')).state).toBe('open');
  });

  it('rejects malformed times', () => {
    const broken: BranchHours = { ...clinic, weekly: every([1], '8am', '17:00') };
    expect(() => openStatus(broken, manila('2026-10-05 09:00'))).toThrow('Invalid time "8am"');
  });
});

describe('isOpenNow, closesAt, nextOpening', () => {
  it('agree with openStatus', () => {
    const lunch = manila('2026-10-05 12:30');
    const morning = manila('2026-10-05 10:00');

    expect(isOpenNow(clinic, morning)).toBe(true);
    expect(isOpenNow(clinic, lunch)).toBe(false);
    expect(isOpenNow({ is24h: true, weekly: [], exceptions: [] }, morning)).toBe(true);

    expect(closesAt(clinic, morning)).toEqual({
      date: '2026-10-05',
      time: '12:00',
      daysFromToday: 0,
    });
    expect(closesAt(clinic, lunch)).toBeNull();

    expect(nextOpening(clinic, lunch)).toEqual({
      date: '2026-10-05',
      time: '13:00',
      daysFromToday: 0,
    });
  });

  it('gives the opening after the current period when open now', () => {
    expect(nextOpening(clinic, manila('2026-10-05 10:00'))).toEqual({
      date: '2026-10-05',
      time: '13:00',
      daysFromToday: 0,
    });
  });
});

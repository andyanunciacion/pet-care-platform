import { describe, expect, it } from 'vitest';
import { freshness } from './freshness.ts';

const manila = (dateTime: string) => new Date(`${dateTime.replace(' ', 'T')}:00+08:00`);
const now = manila('2026-10-05 10:00');

describe('freshness (UX5)', () => {
  it('is fresh up to 30 days', () => {
    expect(freshness(manila('2026-10-05 09:00'), now)).toEqual({ level: 'fresh', daysAgo: 0 });
    expect(freshness(manila('2026-09-05 10:00'), now)).toEqual({ level: 'fresh', daysAgo: 30 });
  });

  it('is aging from 31 to 90 days ("May have changed. Call ahead.")', () => {
    expect(freshness(manila('2026-09-04 10:00'), now)).toEqual({ level: 'aging', daysAgo: 31 });
    expect(freshness(manila('2026-07-07 10:00'), now)).toEqual({ level: 'aging', daysAgo: 90 });
  });

  it('is stale after 90 days, or if never confirmed', () => {
    expect(freshness(manila('2026-07-06 10:00'), now)).toEqual({ level: 'stale', daysAgo: 91 });
    expect(freshness(null, now)).toEqual({ level: 'stale', daysAgo: null });
  });

  it('counts Manila calendar days', () => {
    // 11 PM yesterday is "1 day ago", even though fewer than 24 hours have passed.
    expect(freshness(manila('2026-10-04 23:00'), manila('2026-10-05 01:00')).daysAgo).toBe(1);
    // 23:30 UTC on Oct 4 is already Oct 5 in Manila: today.
    expect(freshness(new Date('2026-10-04T23:30:00Z'), now).daysAgo).toBe(0);
  });

  it('treats a confirmation slightly in the future as today', () => {
    expect(freshness(manila('2026-10-06 10:00'), now)).toEqual({ level: 'fresh', daysAgo: 0 });
  });
});

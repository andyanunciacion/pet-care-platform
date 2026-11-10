import { describe, expect, it } from 'vitest';
import { parseDayHours } from './hours-text.ts';

const open = (...pairs: [string, string][]) => ({
  kind: 'open',
  intervals: pairs.map(([opensAt, closesAt]) => ({ opensAt, closesAt })),
});

describe('parseDayHours', () => {
  it('reads blank and closed days', () => {
    expect(parseDayHours('')).toEqual({ kind: 'blank' });
    expect(parseDayHours('   ')).toEqual({ kind: 'blank' });
    expect(parseDayHours('Closed')).toEqual({ kind: 'closed' });
    expect(parseDayHours(' sarado ')).toEqual({ kind: 'closed' });
  });

  it.each([
    ['8am-5pm', open(['08:00', '17:00'])],
    ['8 AM - 5 PM', open(['08:00', '17:00'])],
    ['8:30 a.m. to 5:30 p.m.', open(['08:30', '17:30'])],
    ['08:00-17:00', open(['08:00', '17:00'])],
    ['8:00–17:00', open(['08:00', '17:00'])],
    ['9-12', open(['09:00', '12:00'])],
    ['7:00-24:00', open(['07:00', '00:00'])],
  ])('reads %j', (text, expected) => {
    expect(parseDayHours(text)).toEqual(expected);
  });

  it('reads 12nn, 12mn, noon and midnight', () => {
    expect(parseDayHours('8am-12nn')).toEqual(open(['08:00', '12:00']));
    expect(parseDayHours('8am-12:00 nn')).toEqual(open(['08:00', '12:00']));
    expect(parseDayHours('8am-12 noon')).toEqual(open(['08:00', '12:00']));
    expect(parseDayHours('noon-midnight')).toEqual(open(['12:00', '00:00']));
    expect(parseDayHours('6pm-12mn')).toEqual(open(['18:00', '00:00']));
    expect(parseDayHours('12am-6am')).toEqual(open(['00:00', '06:00']));
    expect(parseDayHours('12pm-1pm')).toEqual(open(['12:00', '13:00']));
  });

  it('reads several intervals (lunch breaks)', () => {
    const lunch = open(['08:00', '12:00'], ['13:00', '17:00']);
    expect(parseDayHours('8:00-12:00, 13:00-17:00')).toEqual(lunch);
    expect(parseDayHours('8am-12nn 1pm-5pm')).toEqual(lunch);
    expect(parseDayHours('8am-12nn; 1pm-5pm')).toEqual(lunch);
    expect(parseDayHours('8am-12nn / 1pm-5pm')).toEqual(lunch);
    expect(parseDayHours('8am-12nn and 1pm-5pm')).toEqual(lunch);
    expect(parseDayHours('8am - 12nn & 1 pm - 5 pm')).toEqual(lunch);
  });

  it('reads overnight intervals', () => {
    expect(parseDayHours('8pm-2am')).toEqual(open(['20:00', '02:00']));
    expect(parseDayHours('20:00-02:00')).toEqual(open(['20:00', '02:00']));
  });

  it('rejects "8-5" as ambiguous, but not when am/pm or a 24-hour time says which', () => {
    expect(parseDayHours('8-5')).toEqual({ kind: 'invalid', issue: 'ambiguous', part: '8-5' });
    expect(parseDayHours('9am-12nn, 1-5')).toEqual({
      kind: 'invalid',
      issue: 'ambiguous',
      part: '1-5',
    });
    expect(parseDayHours('1:00-5:00')).toMatchObject({ kind: 'invalid', issue: 'ambiguous' });
    expect(parseDayHours('8-5am')).toEqual(open(['08:00', '05:00']));
    expect(parseDayHours('1am-5am')).toEqual(open(['01:00', '05:00']));
    expect(parseDayHours('22-5')).toEqual(open(['22:00', '05:00']));
    expect(parseDayHours('6-9')).toEqual(open(['06:00', '09:00']));
  });

  it('sends "24 hours" to the 24-hour flag', () => {
    for (const text of ['24 hours', '24h', 'Open 24 hrs', '24/7']) {
      expect(parseDayHours(text)).toMatchObject({ kind: 'invalid', issue: 'all_day' });
    }
  });

  it.each([
    'by appointment',
    '8am',
    '8am-',
    '8am-5pm-7pm',
    '13pm-5pm',
    '8:60-17:00',
    '25:00-26:00',
    '8nn-5pm',
    '0am-5pm',
  ])('rejects %j as unreadable', (text) => {
    expect(parseDayHours(text)).toMatchObject({ kind: 'invalid', issue: 'unreadable' });
  });

  it('leaves overlap and count checks to weeklyHoursIssues', () => {
    expect(parseDayHours('8am-5pm, 9am-10am')).toEqual(
      open(['08:00', '17:00'], ['09:00', '10:00']),
    );
    expect(parseDayHours('8am-8am')).toEqual(open(['08:00', '08:00']));
  });
});

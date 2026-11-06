import { describe, expect, it } from 'vitest';
import { normalizePhPhone } from './phone.ts';

describe('normalizePhPhone', () => {
  it.each([
    ['0917 123 4567', '+639171234567'],
    ['0917-123-4567', '+639171234567'],
    ['+63 917 123 4567', '+639171234567'],
    ['63 917 123 4567', '+639171234567'],
    ['9171234567', '+639171234567'],
    ['+639171234567', '+639171234567'],
  ])('mobile %s → %s', (input, e164) => {
    expect(normalizePhPhone(input)).toBe(e164);
  });

  it.each([
    ['(045) 888 1234', '+63458881234'],
    ['045-888-1234', '+63458881234'],
    ['(02) 8123 4567', '+63281234567'],
    ['+63 45 888 1234', '+63458881234'],
  ])('landline %s → %s', (input, e164) => {
    expect(normalizePhPhone(input)).toBe(e164);
  });

  it('accepts numbers from other countries in E.164', () => {
    expect(normalizePhPhone('+1 415 555 2671')).toBe('+14155552671');
  });

  it.each([
    '',
    'call us',
    '0917 123 456', // a digit short
    '0917 123 45678', // a digit too many
    '+63 117 123 4567', // no PH number starts with 1
    '888 1234', // landline without its area code
    '+0 123 4567',
  ])('rejects %j', (input) => {
    expect(normalizePhPhone(input)).toBeNull();
  });
});

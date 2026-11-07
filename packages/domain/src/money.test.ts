import { describe, expect, it } from 'vitest';
import { formatPesos, parsePesos } from './money.ts';

describe('parsePesos', () => {
  it.each([
    ['800', 80_000],
    ['1500', 150_000],
    ['1,500', 150_000],
    ['1,500.50', 150_050],
    ['1500.5', 150_050],
    ['0.05', 5],
    ['0', 0],
    ['₱1,500', 150_000],
    ['₱ 800', 80_000],
    ['PHP 800', 80_000],
    ['P800', 80_000],
    ['  800  ', 80_000],
    ['1,000,000', 100_000_000],
  ])('%s → %i centavos', (text, centavos) => {
    expect(parsePesos(text)).toBe(centavos);
  });

  it.each(['', '   '])('empty text %j → null (no price)', (text) => {
    expect(parsePesos(text)).toBeNull();
  });

  it.each(['abc', '-500', '1.505', '1,50', '15,00', '1 500', '₱', '500php', '1e3', '.5'])(
    '%j → undefined (not an amount)',
    (text) => {
      expect(parsePesos(text)).toBeUndefined();
    },
  );
});

describe('formatPesos', () => {
  it.each([
    [0, '0'],
    [5, '0.05'],
    [80_000, '800'],
    [150_000, '1,500'],
    [150_050, '1,500.50'],
    [100_000_000, '1,000,000'],
  ])('%i centavos → %s', (centavos, text) => {
    expect(formatPesos(centavos)).toBe(text);
  });

  it('round-trips with parsePesos', () => {
    for (const centavos of [1, 99, 100, 123_456, 99_999_999]) {
      expect(parsePesos(formatPesos(centavos))).toBe(centavos);
    }
  });
});

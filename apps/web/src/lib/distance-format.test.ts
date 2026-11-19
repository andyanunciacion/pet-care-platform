import { describe, expect, it } from 'vitest';
import { distanceLabel } from './distance-format';

describe('distanceLabel', () => {
  it('shows metres to the nearest 100 under 1 km, never "0 m"', () => {
    expect(distanceLabel(649, 'en')).toBe('600 m');
    expect(distanceLabel(651, 'en')).toBe('700 m');
    expect(distanceLabel(12, 'en')).toBe('100 m');
  });

  it('shows km with one decimal under 10 km, whole km beyond', () => {
    expect(distanceLabel(960, 'en')).toBe('1 km');
    expect(distanceLabel(2_140, 'en')).toBe('2.1 km');
    expect(distanceLabel(12_400, 'en')).toBe('12 km');
  });
});

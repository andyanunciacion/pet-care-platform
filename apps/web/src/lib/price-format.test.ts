import { describe, expect, it } from 'vitest';
import { servicePriceLabel, type PriceLabels } from './price-format';

const labels: PriceLabels = {
  amount: (amount) => `₱${amount}`,
  range: (min, max) => `₱${min}–₱${max}`,
  from: (min) => `From ₱${min}`,
  callForPrice: 'Call for price',
  unit: (unit) => ({ per_night: '/night', per_day: '/day' })[unit],
};

describe('servicePriceLabel', () => {
  it('shows a range, a starting price, one price, or "Call for price"', () => {
    const price = (priceMin: number | null, priceMax: number | null) =>
      servicePriceLabel({ priceMin, priceMax, priceUnit: 'per_visit' }, labels);

    expect(price(50_000, 80_000)).toBe('₱500–₱800');
    expect(price(150_000, null)).toBe('From ₱1,500');
    expect(price(50_000, 50_000)).toBe('₱500');
    expect(price(null, null)).toBe('Call for price');
  });

  it('adds the unit unless it is per visit', () => {
    expect(
      servicePriceLabel({ priceMin: 80_000, priceMax: null, priceUnit: 'per_night' }, labels),
    ).toBe('From ₱800/night');
    expect(
      servicePriceLabel({ priceMin: 50_050, priceMax: 80_000, priceUnit: 'per_day' }, labels),
    ).toBe('₱500.50–₱800/day');
  });

  it('never adds a unit to "Call for price"', () => {
    expect(
      servicePriceLabel({ priceMin: null, priceMax: null, priceUnit: 'per_night' }, labels),
    ).toBe('Call for price');
  });
});

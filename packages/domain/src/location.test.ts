import { describe, expect, it } from 'vitest';
import { isInPhilippines, parseLatLng } from './location.ts';

describe('parseLatLng', () => {
  it('reads Google Maps order (lat, lng)', () => {
    expect(parseLatLng('15.1450, 120.5887')).toEqual({ lat: 15.145, lng: 120.5887 });
    expect(parseLatLng('  15.145 120.5887 ')).toEqual({ lat: 15.145, lng: 120.5887 });
    expect(parseLatLng('-33.8688,151.2093')).toEqual({ lat: -33.8688, lng: 151.2093 });
  });

  it.each(['', '15.145', 'Angeles City', '15.145, 120.5887, 3', '91, 120', '15, 181'])(
    'rejects %j',
    (text) => {
      expect(parseLatLng(text)).toBeNull();
    },
  );
});

describe('isInPhilippines', () => {
  it('accepts Angeles City', () => {
    expect(isInPhilippines({ lng: 120.5887, lat: 15.145 })).toBe(true);
  });

  it('rejects swapped coordinates and other countries', () => {
    expect(isInPhilippines({ lng: 15.145, lat: 120.5887 })).toBe(false);
    expect(isInPhilippines({ lng: 151.2093, lat: -33.8688 })).toBe(false);
  });
});

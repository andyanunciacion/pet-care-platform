import { describe, expect, it } from 'vitest';
import type { Taxonomy } from './public-types';
import { activeFilters, isNightInManila, widerRadius } from './search-filters';
import type { SearchState } from './search-href';

const taxonomy: Taxonomy = {
  species: [{ id: '1', code: 'rabbit', name: 'Rabbit' }],
  categories: [
    {
      id: '2',
      code: 'surgery',
      name: 'Surgery',
      children: [{ id: '3', code: 'spay_neuter', name: 'Spay / neuter' }],
    },
  ],
};

const near = { kind: 'near', lat: 15.145, lng: 120.589 } as const;

describe('activeFilters', () => {
  it('names each filter and links to the search without it (and without the cursor)', () => {
    const state: SearchState = {
      q: 'kapon',
      location: { kind: 'city', code: '0330100000' },
      species: 'rabbit',
      category: 'spay_neuter',
      openNow: true,
      cursor: 'abc',
    };
    expect(activeFilters(state, taxonomy)).toEqual([
      {
        // The words come first: a "Kapon" quick chip can be undone like a filter.
        kind: 'query',
        name: 'kapon',
        href: '/search?cityCode=0330100000&species=rabbit&category=spay_neuter&openNow=true',
      },
      {
        kind: 'species',
        name: 'Rabbit',
        href: '/search?q=kapon&cityCode=0330100000&category=spay_neuter&openNow=true',
      },
      {
        kind: 'category',
        name: 'Spay / neuter',
        href: '/search?q=kapon&cityCode=0330100000&species=rabbit&openNow=true',
      },
      {
        kind: 'openNow',
        name: null,
        href: '/search?q=kapon&cityCode=0330100000&species=rabbit&category=spay_neuter',
      },
    ]);
  });

  it("doesn't list Emergency: it's its own view (/emergency), not a filter", () => {
    expect(activeFilters({ location: { kind: 'all' }, emergency: true }, taxonomy)).toEqual([]);
  });

  it('finds a group by its code too', () => {
    expect(
      activeFilters({ location: { kind: 'all' }, category: 'surgery' }, taxonomy)[0]?.name,
    ).toBe('Surgery');
  });
});

describe('widerRadius', () => {
  it('offers 25 km, then 50 km, then nothing', () => {
    expect(widerRadius(near)).toEqual({ km: 25, location: { ...near, radiusKm: 25 } });
    expect(widerRadius({ ...near, radiusKm: 25 })?.km).toBe(50);
    expect(widerRadius({ ...near, radiusKm: 50 })).toBeNull();
  });

  it('has nothing to widen for a city or the whole area', () => {
    expect(widerRadius({ kind: 'city', code: '0330100000' })).toBeNull();
    expect(widerRadius({ kind: 'all' })).toBeNull();
  });
});

describe('isNightInManila', () => {
  it('is night from 7 PM to 7 AM Manila time (UTC+8)', () => {
    expect(isNightInManila(new Date('2026-11-19T10:59:00Z'))).toBe(false); // 6:59 PM
    expect(isNightInManila(new Date('2026-11-19T11:00:00Z'))).toBe(true); // 7:00 PM
    expect(isNightInManila(new Date('2026-11-19T22:59:00Z'))).toBe(true); // 6:59 AM
    expect(isNightInManila(new Date('2026-11-19T23:00:00Z'))).toBe(false); // 7:00 AM
  });
});

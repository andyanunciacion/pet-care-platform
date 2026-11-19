import { describe, expect, it } from 'vitest';
import {
  compareSortKeys,
  matchListing,
  MAX_MATCHED_SERVICES,
  MAX_QUERY_LENGTH,
  MAX_QUERY_TOKENS,
  searchScore,
  searchSortKey,
  searchTerms,
  SPECIES_SCORE,
  type ScoreInput,
  type TokenHits,
} from './search.ts';

describe('searchTerms', () => {
  it('lowercases and splits on anything but letters and digits', () => {
    expect(searchTerms('  Anti-Rabies   5-in-1 ')).toEqual({
      query: 'anti-rabies 5-in-1',
      tokens: ['anti', 'rabies', '5', 'in', '1'],
    });
  });

  it('keeps letters with accents and ñ', () => {
    expect(searchTerms('Parañaque Peñafrancia').tokens).toEqual(['parañaque', 'peñafrancia']);
  });

  it('drops Filipino particles', () => {
    expect(searchTerms('saan may kapon ng pusa sa Angeles').tokens).toEqual([
      'may',
      'kapon',
      'pusa',
      'angeles',
    ]);
  });

  it('drops generic words, so "vet near me" is a browse', () => {
    expect(searchTerms('vet near me')).toEqual({ query: 'vet near me', tokens: [] });
    expect(searchTerms('Vet Clinic for cats').tokens).toEqual(['for', 'cats']);
  });

  it('removes repeats and caps the number of words', () => {
    expect(searchTerms('kapon kapon KAPON').tokens).toEqual(['kapon']);
    expect(searchTerms('a b c d e f g h i j').tokens).toHaveLength(MAX_QUERY_TOKENS);
  });

  it('treats a missing or blank query as a browse', () => {
    expect(searchTerms(undefined)).toEqual({ query: '', tokens: [] });
    expect(searchTerms(' ?! ')).toEqual({ query: '?!', tokens: [] });
  });

  it('caps the logged query length', () => {
    expect(searchTerms('x'.repeat(300)).query).toHaveLength(MAX_QUERY_LENGTH);
  });
});

const hits = (own: number[], species: boolean[] = own.map(() => false)): TokenHits => ({
  own,
  species,
});

describe('matchListing', () => {
  it('matches everything on a browse', () => {
    expect(matchListing({ tokenCount: 0, branch: null, services: [] })).toEqual({
      relevance: 1,
      services: [],
    });
  });

  it('matches a branch by name, without services (UX3)', () => {
    expect(matchListing({ tokenCount: 1, branch: hits([1]), services: [] })).toEqual({
      relevance: 1,
      services: [],
    });
  });

  it('needs every word somewhere', () => {
    expect(matchListing({ tokenCount: 2, branch: hits([1, 0]), services: [] })).toBeNull();
    expect(matchListing({ tokenCount: 1, branch: null, services: [] })).toBeNull();
  });

  it('lets the branch supply words a service lacks ("kapon angeles")', () => {
    const match = matchListing({
      tokenCount: 2,
      branch: hits([0, 0.8]),
      services: [{ id: 'spay', hits: hits([0.8, 0]) }],
    });
    expect(match).toEqual({ relevance: 0.8, services: [{ id: 'spay', relevance: 0.8 }] });
  });

  it("uses the service's species, not the branch's ('kapon pusa')", () => {
    // The branch treats cats, but its spay/neuter service is for dogs only.
    const dogsOnly = { id: 'spay', hits: hits([0.8, 0], [false, false]) };
    expect(
      matchListing({ tokenCount: 2, branch: hits([0, 0], [false, true]), services: [dogsOnly] }),
    ).toBeNull();

    const forCats = { id: 'spay', hits: hits([0.8, 0], [false, true]) };
    expect(
      matchListing({ tokenCount: 2, branch: hits([0, 0], [false, true]), services: [forCats] }),
    ).toEqual({
      relevance: (0.8 + SPECIES_SCORE) / 2,
      services: [{ id: 'spay', relevance: (0.8 + SPECIES_SCORE) / 2 }],
    });
  });

  it("doesn't match a service on species alone", () => {
    // "pusa": every cat service names cats, but the search is for the branch.
    const match = matchListing({
      tokenCount: 1,
      branch: hits([0], [true]),
      services: [{ id: 'vaccine', hits: hits([0], [true]) }],
    });
    expect(match).toEqual({ relevance: SPECIES_SCORE, services: [] });
  });

  it('orders matched services best first, then in display order, and caps them', () => {
    const services = ['a', 'b', 'c', 'd', 'e'].map((id, index) => ({
      id,
      hits: hits([index === 3 ? 1 : 0.6]),
    }));
    const match = matchListing({ tokenCount: 1, branch: null, services });
    expect(match?.services.map((service) => service.id)).toEqual(['d', 'a', 'b']);
    expect(match?.services).toHaveLength(MAX_MATCHED_SERVICES);
    expect(match?.relevance).toBe(1);
  });

  it('prefers a service match to a branch match', () => {
    // "dental": the business is called "Dental Pet Care" and offers dental cleaning.
    const match = matchListing({
      tokenCount: 1,
      branch: hits([1]),
      services: [{ id: 'dental', hits: hits([0.8]) }],
    });
    expect(match?.services).toEqual([{ id: 'dental', relevance: 1 }]);
  });
});

const base: ScoreInput = {
  relevance: 1,
  distanceKm: null,
  verified: false,
  freshness: 'aging',
  hasHours: true,
};

describe('searchScore', () => {
  it('is the relevance when nothing else applies', () => {
    expect(searchScore(base)).toBe(1);
    expect(searchScore({ ...base, relevance: 0.4 })).toBe(0.4);
  });

  it('halves at 3 km', () => {
    expect(searchScore({ ...base, distanceKm: 0 })).toBe(1);
    expect(searchScore({ ...base, distanceKm: 3 })).toBe(0.5);
  });

  it('ranks a real match above a typo match at the same distance', () => {
    // The best typo score is 0.5; the weakest real match (a description) is 0.6.
    expect(searchScore({ ...base, relevance: 0.6 })).toBeGreaterThan(
      searchScore({ ...base, relevance: 0.5 }),
    );
  });

  it('boosts verified and fresh listings, and lowers ones without hours', () => {
    expect(searchScore({ ...base, verified: true })).toBeCloseTo(1.15);
    expect(searchScore({ ...base, freshness: 'fresh' })).toBeCloseTo(1.1);
    expect(searchScore({ ...base, freshness: 'stale' })).toBeCloseTo(0.9);
    expect(searchScore({ ...base, hasHours: false })).toBeCloseTo(0.75);
  });

  it('lets distance outweigh the boosts', () => {
    const nearUnverified = searchScore({ ...base, distanceKm: 1 });
    const farVerified = searchScore({ ...base, distanceKm: 8, verified: true, freshness: 'fresh' });
    expect(nearUnverified).toBeGreaterThan(farVerified);
  });
});

describe('searchSortKey / compareSortKeys', () => {
  const sorted = (keys: number[][]) => [...keys].sort(compareSortKeys);

  it('orders normal searches by score, highest first', () => {
    expect(sorted([[0.2], [0.9], [0.5]])).toEqual([[0.9], [0.5], [0.2]]);
  });

  it('puts open branches before callable ones, each nearest first (UX7, UX19)', () => {
    const keys = [
      searchSortKey(1, { group: 'callable', distanceKm: 1 }),
      searchSortKey(1, { group: 'open', distanceKm: 5 }),
      searchSortKey(1, { group: 'open', distanceKm: 2 }),
    ];
    expect(sorted(keys)).toEqual([
      [1, -2],
      [1, -5],
      [0, -1],
    ]);
  });

  it('falls back to the score for emergencies without a location', () => {
    expect(searchSortKey(0.7, { group: 'open', distanceKm: null })).toEqual([1, 0.7]);
    expect(searchSortKey(0.7, null)).toEqual([0.7]);
  });
});

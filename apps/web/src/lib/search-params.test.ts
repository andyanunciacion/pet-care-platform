import { describe, expect, it } from 'vitest';
import { firstPage, roundCoord, searchHref, type SearchState } from './search-href';
import { parseSearchParams } from './search-params';

const ANGELES = '0330100000';

describe('parseSearchParams', () => {
  it('reads a full search', () => {
    expect(
      parseSearchParams({
        q: 'kapon',
        lat: '15.145',
        lng: '120.589',
        radiusKm: '25',
        species: 'cat',
        category: 'spay_neuter',
        openNow: 'true',
        cursor: 'abc',
      }),
    ).toEqual({
      q: 'kapon',
      location: { kind: 'near', lat: 15.145, lng: 120.589, radiusKm: 25 },
      species: 'cat',
      category: 'spay_neuter',
      openNow: true,
      cursor: 'abc',
    } satisfies SearchState);
  });

  it('searches the whole area when there is no location', () => {
    expect(parseSearchParams({})).toEqual({ location: { kind: 'all' } });
  });

  it('takes a city, but prefers a point when both are sent', () => {
    expect(parseSearchParams({ cityCode: ANGELES }).location).toEqual({
      kind: 'city',
      code: ANGELES,
    });
    expect(parseSearchParams({ cityCode: ANGELES, lat: '15.1', lng: '120.5' }).location).toEqual({
      kind: 'near',
      lat: 15.1,
      lng: 120.5,
    });
  });

  it('drops values the API would reject instead of failing the page', () => {
    expect(
      parseSearchParams({
        lat: '51.5', // London: outside the Philippines
        lng: '-0.12',
        cityCode: 'angeles',
        species: 'Dog; drop table',
        radiusKm: '500',
        openNow: 'yes',
        q: '   ',
      }),
    ).toEqual({ location: { kind: 'all' } });
    // Half a point is no point; a radius without one is ignored.
    expect(parseSearchParams({ lat: '15.1', radiusKm: '5' }).location).toEqual({ kind: 'all' });
  });

  it('takes the last non-empty value when a chip adds its own q to the form', () => {
    expect(parseSearchParams({ q: ['', 'kapon'] }).q).toBe('kapon');
    expect(parseSearchParams({ q: ['rabbit', ''] }).q).toBe('rabbit');
  });
});

describe('searchHref', () => {
  it('builds the same URL that parseSearchParams reads back', () => {
    const state: SearchState = {
      q: 'kapon',
      location: { kind: 'city', code: ANGELES },
      species: 'cat',
      openNow: true,
    };
    const href = searchHref(state);
    expect(href).toBe(`/search?q=kapon&cityCode=${ANGELES}&species=cat&openNow=true`);
    const params = new URL(href, 'https://paw.test').searchParams;
    expect(parseSearchParams(Object.fromEntries(params))).toEqual(state);
  });

  it('rounds the owner position to 3 decimals', () => {
    expect(searchHref({ location: { kind: 'near', lat: 15.145_678_9, lng: 120.588_712_3 } })).toBe(
      '/search?lat=15.146&lng=120.589',
    );
    expect(roundCoord(120.588_49)).toBe(120.588);
  });

  it('gives a bare /search for the whole area, and firstPage drops the cursor', () => {
    expect(searchHref({ location: { kind: 'all' } })).toBe('/search');
    expect(searchHref(firstPage({ location: { kind: 'all' }, cursor: 'abc' }))).toBe('/search');
  });
});

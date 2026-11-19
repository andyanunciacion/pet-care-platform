import { cache } from 'react';
import type { Cities, Taxonomy } from './public-types';
import { publicApi } from './public-api';

// Reference data for the search pages: the filters' species and categories, and the city
// picker. It changes rarely, so it's read through the cached public client (ARCHITECTURE D41)
// and shared by every search; the results themselves are never cached (D46).

export const loadTaxonomy = cache(async (): Promise<Taxonomy> => {
  const { data } = await publicApi().GET('/v1/taxonomy');
  // Without it the filters can't be built; let the page fail rather than show empty filters.
  if (data === undefined) throw new Error('GET /v1/taxonomy failed');
  return data;
});

export const loadCities = cache(async (): Promise<Cities> => {
  const { data } = await publicApi().GET('/v1/cities');
  if (data === undefined) throw new Error('GET /v1/cities failed');
  return data;
});

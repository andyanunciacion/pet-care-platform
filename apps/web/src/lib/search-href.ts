// Search URLs (/search?…, /emergency?…), built one way for every link, chip and form on the
// search pages.
// No Zod here: Client Components import this file, and the owner pages' JavaScript budget is
// tight (DESIGN §9). Parsing a URL back into a search is search-params.ts (server only).

import type { SearchApiQuery } from './public-types';

/**
 * Where to search (DESIGN UX1): near the owner, in a city they picked, or the whole area.
 * The URL is the truth for a results page; the browser only remembers which *kind* of
 * location the owner prefers (ARCHITECTURE D46).
 */
export type SearchLocation =
  | { kind: 'near'; lat: number; lng: number; radiusKm?: number }
  | { kind: 'city'; code: string }
  | { kind: 'all' };

export interface SearchState {
  q?: string;
  location: SearchLocation;
  /** A species code ("rabbit"). */
  species?: string;
  /** A category or group code ("spay_neuter", "surgery"). */
  category?: string;
  openNow?: boolean;
  emergency?: boolean;
  /** `nextCursor` from the API, for the page after. */
  cursor?: string;
}

/**
 * Coordinates go into URLs rounded to 3 decimals (about 110 m): close enough for "2.1 km",
 * without putting the owner's exact position in links and server logs (ARCHITECTURE D46).
 */
export function roundCoord(value: number): number {
  return Math.round(value * 1000) / 1000;
}

/** The search as URL parameters, in a fixed order (the same search always has the same URL). */
export function searchParamsOf(state: SearchState): URLSearchParams {
  const params = new URLSearchParams();
  const q = state.q?.trim();
  if (q !== undefined && q !== '') params.set('q', q);
  const { location } = state;
  if (location.kind === 'near') {
    params.set('lat', String(roundCoord(location.lat)));
    params.set('lng', String(roundCoord(location.lng)));
    if (location.radiusKm !== undefined) params.set('radiusKm', String(location.radiusKm));
  } else if (location.kind === 'city') {
    params.set('cityCode', location.code);
  }
  if (state.species !== undefined) params.set('species', state.species);
  if (state.category !== undefined) params.set('category', state.category);
  if (state.openNow === true) params.set('openNow', 'true');
  if (state.emergency === true) params.set('emergency', 'true');
  if (state.cursor !== undefined) params.set('cursor', state.cursor);
  return params;
}

/** "/search?q=kapon&cityCode=0330100000" */
export function searchHref(state: SearchState): string {
  const query = searchParamsOf(state).toString();
  return query === '' ? '/search' : `/search?${query}`;
}

/**
 * The emergency view (DESIGN UX7): "/emergency?cityCode=0330100000". It takes only the place
 * (and the page after): the words and filters of a search don't apply to an emergency.
 */
export function emergencyHref(location: SearchLocation, cursor?: string): string {
  const query = searchParamsOf({ location, ...(cursor !== undefined && { cursor }) }).toString();
  return query === '' ? '/emergency' : `/emergency?${query}`;
}

/** The search as GET /v1/search takes it. */
export function apiQuery(state: SearchState): SearchApiQuery {
  const { location } = state;
  return {
    ...(state.q !== undefined && { q: state.q }),
    ...(location.kind === 'near' && {
      lat: roundCoord(location.lat),
      lng: roundCoord(location.lng),
      ...(location.radiusKm !== undefined && { radiusKm: location.radiusKm }),
    }),
    ...(location.kind === 'city' && { cityCode: location.code }),
    ...(state.species !== undefined && { species: state.species }),
    ...(state.category !== undefined && { category: state.category }),
    ...(state.openNow === true && { openNow: 'true' }),
    ...(state.emergency === true && { emergency: 'true' }),
    ...(state.cursor !== undefined && { cursor: state.cursor }),
  };
}

/** The same search without paging: the base for every filter link and for a new search. */
export function firstPage(state: SearchState): SearchState {
  return { ...state, cursor: undefined };
}

import { isInPhilippines, MAX_RADIUS_KM } from '@paw/domain';
import { z } from 'zod';
import type { SearchLocation, SearchState } from './search-href';

// Reads a /search URL back into a search (server only: it uses Zod). Anyone can type a URL,
// so a value that doesn't fit is dropped rather than sent on: the API would answer 400 and
// the page would fail, when the rest of the search is still worth showing.

type RawParams = Record<string, string | string[] | undefined>;

const TaxonomyCode = z.string().regex(/^[a-z0-9]+(_[a-z0-9]+)*$/);
const CityCode = z.string().regex(/^[0-9]{10}$/);
const Coordinate = z.coerce.number();
const Radius = z.coerce.number().positive().max(MAX_RADIUS_KM);
const Query = z.string().trim().min(1).max(200);
const Cursor = z.string().min(1).max(500);

/**
 * The last non-empty value of a parameter. A chip that adds its own "q" to a form that
 * already has a search box sends q twice ("q=&q=kapon"); the chip's comes last.
 */
function lastValue(raw: RawParams, name: string): string | undefined {
  const value = raw[name];
  const values = Array.isArray(value) ? value : value === undefined ? [] : [value];
  return values.filter((item) => item.trim() !== '').at(-1);
}

function parsed<T>(schema: z.ZodType<T>, value: string | undefined): T | undefined {
  if (value === undefined) return undefined;
  const result = schema.safeParse(value);
  return result.success ? result.data : undefined;
}

function parseLocation(raw: RawParams): SearchLocation {
  const lat = parsed(Coordinate, lastValue(raw, 'lat'));
  const lng = parsed(Coordinate, lastValue(raw, 'lng'));
  // A point wins over a city: it's the more precise of the two, and the API takes only one.
  if (lat !== undefined && lng !== undefined && isInPhilippines({ lat, lng })) {
    const radiusKm = parsed(Radius, lastValue(raw, 'radiusKm'));
    return { kind: 'near', lat, lng, ...(radiusKm !== undefined && { radiusKm }) };
  }
  const code = parsed(CityCode, lastValue(raw, 'cityCode'));
  return code === undefined ? { kind: 'all' } : { kind: 'city', code };
}

/** Next's `searchParams` → the search it describes. Never throws. */
export function parseSearchParams(raw: RawParams): SearchState {
  const state: SearchState = { location: parseLocation(raw) };
  const q = parsed(Query, lastValue(raw, 'q'));
  if (q !== undefined) state.q = q;
  const species = parsed(TaxonomyCode, lastValue(raw, 'species'));
  if (species !== undefined) state.species = species;
  const category = parsed(TaxonomyCode, lastValue(raw, 'category'));
  if (category !== undefined) state.category = category;
  if (lastValue(raw, 'openNow') === 'true') state.openNow = true;
  if (lastValue(raw, 'emergency') === 'true') state.emergency = true;
  const cursor = parsed(Cursor, lastValue(raw, 'cursor'));
  if (cursor !== undefined) state.cursor = cursor;
  return state;
}

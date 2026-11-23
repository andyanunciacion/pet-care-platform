import { DEFAULT_RADIUS_KM, MAX_RADIUS_KM, toManila } from '@paw/domain';
import type { Taxonomy } from './public-types';
import { firstPage, searchHref, type SearchLocation, type SearchState } from './search-href';

// What narrows a results page (the words and the filters), each with the link that drops it:
// the removable chips above the results, and the "Search without …" offers when nothing
// matched (DESIGN UX12). The words are one too, so a quick chip like "Kapon" can be undone.
// Emergency isn't a filter: it's its own view, /emergency (UX7).

export interface ActiveFilter {
  /** Which filter, for the label: the words, a species or category name, or "Open now". */
  kind: 'query' | 'species' | 'category' | 'openNow';
  /** The words, or the species or category name; null for openNow (fixed copy). */
  name: string | null;
  /** The same search without this filter. */
  href: string;
}

function categoryName(taxonomy: Taxonomy, code: string): string | null {
  for (const group of taxonomy.categories) {
    if (group.code === code) return group.name;
    const child = group.children.find((category) => category.code === code);
    if (child !== undefined) return child.name;
  }
  return null;
}

export function activeFilters(state: SearchState, taxonomy: Taxonomy): ActiveFilter[] {
  const base = firstPage(state);
  const filters: ActiveFilter[] = [];
  if (state.q !== undefined) {
    filters.push({ kind: 'query', name: state.q, href: searchHref({ ...base, q: undefined }) });
  }
  if (state.species !== undefined) {
    filters.push({
      kind: 'species',
      // An unknown code still filters (to nothing), so it's shown, by its code.
      name: taxonomy.species.find((item) => item.code === state.species)?.name ?? state.species,
      href: searchHref({ ...base, species: undefined }),
    });
  }
  if (state.category !== undefined) {
    filters.push({
      kind: 'category',
      name: categoryName(taxonomy, state.category) ?? state.category,
      href: searchHref({ ...base, category: undefined }),
    });
  }
  if (state.openNow === true) {
    filters.push({
      kind: 'openNow',
      name: null,
      href: searchHref({ ...base, openNow: undefined }),
    });
  }
  return filters;
}

/**
 * A wider radius to offer when nothing was found near the owner: 25 km, then the maximum.
 * Null when the place isn't a point or is already as wide as it goes. The caller builds the
 * link (a search, or the emergency view).
 */
export function widerRadius(
  location: SearchLocation,
): { km: number; location: SearchLocation } | null {
  if (location.kind !== 'near') return null;
  const current = location.radiusKm ?? DEFAULT_RADIUS_KM;
  const km = [25, MAX_RADIUS_KM].find((step) => step > current);
  if (km === undefined) return null;
  return { km, location: { ...location, radiusKm: km } };
}

/** 7 PM to 7 AM in Manila: when an owner who found nothing may need an emergency clinic (UX12). */
const NIGHT_STARTS = 19 * 60;
const NIGHT_ENDS = 7 * 60;

export function isNightInManila(now: Date): boolean {
  const { minutes } = toManila(now);
  return minutes >= NIGHT_STARTS || minutes < NIGHT_ENDS;
}

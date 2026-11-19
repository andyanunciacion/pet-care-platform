// Search rules that don't need the database (ARCHITECTURE §6, D45): reading the query,
// deciding whether a listing matches from its per-word hits, and ranking. The API's SQL
// finds the hits (full-text and trigram); everything here is pure and unit-tested.
import type { FreshnessLevel } from './freshness.ts';

/** Radius when the owner shares a location and picks none (covers Angeles, Mabalacat, Clark). */
export const DEFAULT_RADIUS_KM = 10;
export const MAX_RADIUS_KM = 50;
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 50;
export const MAX_QUERY_LENGTH = 100;
/** A query uses at most this many words; the rest are ignored. */
export const MAX_QUERY_TOKENS = 8;
/** A service result shows at most this many matched services (DESIGN UX3 shows the first). */
export const MAX_MATCHED_SERVICES = 3;

/**
 * Score of a word found in a document, by field. Names count most, then categories and
 * synonyms (or the city/barangay for a branch), then descriptions. A word that only
 * matches with a typo scores half its trigram similarity (at most 0.5), so a real match
 * always beats a typo match.
 */
export const FIELD_SCORES = { name: 1, category: 0.8, description: 0.6 } as const;
/** A word naming one of the document's species ("pusa", "rabbit"). */
export const SPECIES_SCORE = 0.6;
/** Minimum pg_trgm word_similarity for a typo match ("kapn" → "kapon"), and the shortest word tried. */
export const TYPO_MIN_SIMILARITY = 0.6;
export const TYPO_MIN_LENGTH = 4;

/** Distance at which the distance factor halves: 1 / (1 + km / 3). */
export const DISTANCE_HALF_KM = 3;
export const RANK_BOOSTS = {
  verified: 1.15,
  freshness: { fresh: 1.1, aging: 1, stale: 0.9 } satisfies Record<FreshnessLevel, number>,
  /** No hours data ranks lower (DESIGN UX17). */
  noHours: 0.75,
} as const;

/**
 * Words that carry no meaning in a search: Filipino particles and question words
 * ("saan may kapon sa angeles"). English ones ("the", "for") are dropped by Postgres.
 */
const PARTICLES = new Set([
  'ang',
  'ba',
  'kay',
  'ko',
  'mga',
  'meron',
  'na',
  'nang',
  'ng',
  'ni',
  'para',
  'po',
  'sa',
  'saan',
  'san',
  'yung',
]);

/**
 * Words that describe every listing (all of them are vets, for now) or the search itself,
 * so "vet near me" becomes a search of everything nearby.
 */
const GENERIC_WORDS = new Set([
  'animal',
  'animals',
  'beterinaryo',
  'clinic',
  'clinics',
  'hospital',
  'klinika',
  'malapit',
  'me',
  'near',
  'nearby',
  'pet',
  'pets',
  'vet',
  'veterinarian',
  'veterinarians',
  'veterinary',
  'vets',
]);

export interface SearchTerms {
  /** The query as typed, lowercased with spaces collapsed (≤ MAX_QUERY_LENGTH): what the search log keeps. */
  query: string;
  /** The words that are searched for: letters and digits only, no particles or generic words, no repeats. Empty = a browse. */
  tokens: string[];
}

export function searchTerms(q: string | undefined): SearchTerms {
  const query = (q ?? '').toLowerCase().replace(/\s+/g, ' ').trim().slice(0, MAX_QUERY_LENGTH);
  const words = query.split(/[^\p{L}\p{N}]+/u).filter((word) => word !== '');
  const tokens = [
    ...new Set(words.filter((word) => !PARTICLES.has(word) && !GENERIC_WORDS.has(word))),
  ].slice(0, MAX_QUERY_TOKENS);
  return { query, tokens };
}

/** Where each search word was found in one document (a branch, or one of its services). */
export interface TokenHits {
  /** Per word, in token order: its best score in the document's own text (FIELD_SCORES or a typo score), 0 if absent. */
  own: readonly number[];
  /** Per word: true if it names one of the document's species. */
  species: readonly boolean[];
}

export interface ListingMatchInput {
  tokenCount: number;
  /** Hits in the branch's document (business and branch names, area, species treated, description). */
  branch: TokenHits | null;
  /** Hits in its services' documents, in display order. Services without any hit can be left out. */
  services: readonly { id: string; hits: TokenHits }[];
}

export interface ListingMatch {
  /** 0–1. */
  relevance: number;
  /** Matched services, best first, at most MAX_MATCHED_SERVICES. Empty for a plain branch match. */
  services: { id: string; relevance: number }[];
}

const mean = (values: readonly number[]) =>
  values.reduce((sum, value) => sum + value, 0) / values.length;
const speciesScore = (hit: boolean | undefined) => (hit === true ? SPECIES_SCORE : 0);

/**
 * Whether a branch matches the search words, and which of its services did.
 *
 * - A **service matches** when at least one word is in the service's own text (its name,
 *   category, synonyms, description) and every other word is in the service, its species,
 *   or the branch's own text ("kapon angeles": kapon in the service, angeles in the branch's
 *   city). The branch's species don't count here, so "kapon pusa" skips a dogs-only service.
 * - Otherwise the **branch matches** when every word is in its own document (with the
 *   species it treats): a plain name, area or species search, which UX3 shows without a
 *   service.
 *
 * Relevance is the mean of the words' scores; with services, that of the best service.
 */
export function matchListing({
  tokenCount,
  branch,
  services,
}: ListingMatchInput): ListingMatch | null {
  if (tokenCount === 0) return { relevance: 1, services: [] };
  const words = Array.from({ length: tokenCount }, (_, index) => index);
  const branchOwn = (index: number) => branch?.own[index] ?? 0;

  const matched = services
    .map(({ id, hits }, order) => {
      const own = (index: number) => hits.own[index] ?? 0;
      if (!words.some((index) => own(index) > 0)) return null;
      const scores = words.map((index) =>
        Math.max(own(index), speciesScore(hits.species[index]), branchOwn(index)),
      );
      return scores.every((score) => score > 0) ? { id, relevance: mean(scores), order } : null;
    })
    .filter((service) => service !== null)
    .sort((a, b) => b.relevance - a.relevance || a.order - b.order)
    .slice(0, MAX_MATCHED_SERVICES)
    .map(({ id, relevance }) => ({ id, relevance }));

  const [best] = matched;
  if (best !== undefined) return { relevance: best.relevance, services: matched };

  const scores = words.map((index) =>
    Math.max(branchOwn(index), speciesScore(branch?.species[index])),
  );
  return scores.every((score) => score > 0) ? { relevance: mean(scores), services: [] } : null;
}

export interface ScoreInput {
  /** From matchListing (1 for a browse). */
  relevance: number;
  /** Null when the search has no location. */
  distanceKm: number | null;
  verified: boolean;
  freshness: FreshnessLevel;
  /** False when the branch has no regular hours (DESIGN UX17). */
  hasHours: boolean;
}

/** relevance × distance factor × boosts. Higher is better. */
export function searchScore({
  relevance,
  distanceKm,
  verified,
  freshness,
  hasHours,
}: ScoreInput): number {
  const distance = distanceKm === null ? 1 : 1 / (1 + distanceKm / DISTANCE_HALF_KM);
  return (
    relevance *
    distance *
    (verified ? RANK_BOOSTS.verified : 1) *
    RANK_BOOSTS.freshness[freshness] *
    (hasHours ? 1 : RANK_BOOSTS.noHours)
  );
}

/**
 * Emergency results (DESIGN UX7, UX19): branches open now, then branches that are closed (or
 * whose hours are unknown) but accept emergencies and can be phoned.
 */
export type EmergencyGroup = 'open' | 'callable';

/**
 * The order of results, compared element by element, higher first; the API breaks ties by
 * id and uses the key as the keyset cursor. Normal searches: [score]. Emergency: open before
 * callable, then nearest first (or by score without a location).
 */
export function searchSortKey(
  score: number,
  emergency: { group: EmergencyGroup; distanceKm: number | null } | null,
): number[] {
  if (emergency === null) return [score];
  const group = emergency.group === 'open' ? 1 : 0;
  return [group, emergency.distanceKm === null ? score : -emergency.distanceKm];
}

/** Negative when `a` comes first (it's higher), like a sort comparator. */
export function compareSortKeys(a: readonly number[], b: readonly number[]): number {
  for (let index = 0; index < Math.max(a.length, b.length); index++) {
    const difference = (b[index] ?? 0) - (a[index] ?? 0);
    if (difference !== 0) return difference;
  }
  return 0;
}

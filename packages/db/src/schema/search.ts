import { index, integer, jsonb, pgTable, text } from 'drizzle-orm/pg-core';
import { id, timestamps } from './columns.ts';

/** The filters of a search, as the API received them (codes, not ids). */
export interface SearchLogFilters {
  species?: string;
  category?: string;
  openNow?: boolean;
  emergency?: boolean;
  radiusKm?: number;
}

/**
 * One row per search (its first page), for ops stats and zero-result reports (P1-11a).
 * No personal data: no IP, session or user agent, and the area is coarse (ARCHITECTURE §6).
 * Append-only.
 */
export const searchLog = pgTable(
  'search_log',
  {
    id: id(),
    /** The query as search read it (lowercased, trimmed), at most 100 characters; "" for a browse. */
    query: text().notNull(),
    filters: jsonb().$type<SearchLogFilters>().notNull().default({}),
    /**
     * Where the search looked: a city's PSGC code, or "lat,lng" rounded to 2 decimals
     * (about 1 km). Null when it searched the whole coverage area.
     */
    area: text(),
    /** Matches before paging; 0 is a zero-result search. */
    resultCount: integer().notNull(),
    createdAt: timestamps.createdAt,
  },
  // Stats read a date range.
  (table) => [index().on(table.createdAt)],
);

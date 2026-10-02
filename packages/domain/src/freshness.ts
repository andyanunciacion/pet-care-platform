// How recently a branch's hours were confirmed (DESIGN UX5).
import { daysBetween, toManila } from './local-time.ts';

/**
 * fresh: confirmed in the last 30 days, shown normally.
 * aging: 31–90 days, "May have changed. Call ahead."
 * stale: over 90 days or never confirmed: warning style, and the listing ranks lower.
 */
export type FreshnessLevel = 'fresh' | 'aging' | 'stale';

export interface Freshness {
  level: FreshnessLevel;
  /** Manila calendar days since confirmation ("confirmed 5 days ago"); null if never confirmed. */
  daysAgo: number | null;
}

export const FRESH_MAX_DAYS = 30;
export const AGING_MAX_DAYS = 90;

export function freshness(confirmedAt: Date | null, now: Date): Freshness {
  if (confirmedAt === null) return { level: 'stale', daysAgo: null };
  // Calendar days, so a confirmation late yesterday reads "1 day ago". Clamped at 0 in case
  // the confirming server's clock ran slightly ahead.
  const daysAgo = Math.max(0, daysBetween(toManila(confirmedAt).date, toManila(now).date));
  const level = daysAgo <= FRESH_MAX_DAYS ? 'fresh' : daysAgo <= AGING_MAX_DAYS ? 'aging' : 'stale';
  return { level, daysAgo };
}

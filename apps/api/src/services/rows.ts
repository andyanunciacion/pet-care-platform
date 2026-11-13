// Small helpers for turning query rows into response shapes, shared by the public services.

/** Groups rows into a map of lists by key, keeping their order. */
export function groupBy<T>(rows: readonly T[], key: (row: T) => string): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const row of rows) groups.set(key(row), [...(groups.get(key(row)) ?? []), row]);
  return groups;
}

/** Postgres returns `time` as "HH:MM:SS"; the API speaks "HH:MM". */
export const hhmm = (time: string) => time.slice(0, 5);

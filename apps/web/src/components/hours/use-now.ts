'use client';

import { useMemo, useSyncExternalStore } from 'react';

// Public pages are cached (ARCHITECTURE D41), so the server's clock can be days behind by the
// time a page is served. Anything that depends on "now" (open status, "3 days ago", today's
// row) reads it from here. On the server and in the first browser render it's null, so the
// HTML only says things that stay true whenever it's served ("Thursday: 8 AM – 5 PM");
// once hydrated, the browser's own clock takes over and ticks every minute.

const MINUTE = 60_000;

/** Wakes subscribers often enough that the minute changes on time. */
function subscribe(onChange: () => void): () => void {
  const id = setInterval(onChange, 15_000);
  return () => {
    clearInterval(id);
  };
}

/** The current minute: a stable value between ticks, as useSyncExternalStore requires. */
const currentMinute = () => Math.floor(Date.now() / MINUTE) * MINUTE;

/** Before hydration (and on the server) there is no trustworthy "now". */
const noMinute = () => null;

/** The browser's current time to the minute, or null until the page is hydrated. */
export function useNow(): Date | null {
  const minute = useSyncExternalStore(subscribe, currentMinute, noMinute);
  return useMemo(() => (minute === null ? null : new Date(minute)), [minute]);
}

'use client';

import { useEffect } from 'react';

/** False until the first page with this component has mounted (a full page load). */
let loadedOnce = false;

/**
 * After a client-side navigation that replaced the control the owner was using (picking a
 * city remounts the location line), focus would fall back to the page body and a screen
 * reader would hear nothing. This moves it to the first heading inside `#{targetId}`, so the
 * new results are announced. Give it a `key` per place so it runs on each new one. A full
 * page load leaves focus alone, like any page.
 */
export function FocusOnArrival({ targetId }: { targetId: string }) {
  useEffect(() => {
    if (!loadedOnce) {
      loadedOnce = true;
      return;
    }
    if (document.activeElement !== null && document.activeElement !== document.body) return;
    const heading = document.querySelector<HTMLElement>(`#${targetId} :is(h2, h3)`);
    if (heading === null) return;
    heading.tabIndex = -1;
    heading.focus();
  }, [targetId]);
  return null;
}

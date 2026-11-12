// Shared by the admin hours editor and the public hours table.
import type { HoursException } from '@paw/domain';
import { useLocale, useTranslations } from 'next-intl';
import { intervalLabel } from '@/lib/hours-format';

/**
 * "Closed — All Saints' Day" or "9 AM – 12 PM, 1 PM – 3 PM". A note that already says it's
 * closed ("Closed for Bonifacio Day") stands alone instead of "Closed — Closed for …".
 */
export function useExceptionSummary() {
  const tHours = useTranslations('Hours');
  const locale = useLocale();
  return (exception: HoursException): string => {
    const note = exception.note ?? null;
    const closed = tHours('closed');
    if (exception.isClosed && note?.toLowerCase().startsWith(closed.toLowerCase())) return note;
    const main = exception.isClosed
      ? closed
      : exception.intervals.map((interval) => intervalLabel(interval, locale)).join(', ');
    return note === null ? main : `${main} — ${note}`;
  };
}

import { ChevronRight, MapPin, Phone } from 'lucide-react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { EmergencyLine, LiveStatus } from '@/components/listing/live-status';
import { outlineAction, primaryAction } from '@/lib/action-styles';
import { telLink } from '@/lib/contact-links';
import { distanceLabel } from '@/lib/distance-format';
import type { SearchResult } from '@/lib/public-types';
import { cn } from '@/lib/utils';
import { areaLine, reachOf } from './result-card';

// One emergency result (DESIGN UX7, principle 7 "calm in emergencies"): only what decides
// where to go: name, area, distance, the live status with the emergency line (first, when
// the branch is closed but takes emergency calls), and a big Call. The clinic page is a small link under it. A branch open now without a phone has no
// Call, so "View clinic" becomes its button (its page lists Messenger and directions).

export function EmergencyCard({
  result,
  renderedAt,
  headingId,
}: {
  result: SearchResult;
  /** When the page was rendered: what the status shows before the browser knows the time. */
  renderedAt: string;
  /** Lets the list move focus to the first card that "Show more" added. */
  headingId?: string;
}) {
  const t = useTranslations('Search');
  const tListing = useTranslations('Listing');
  const locale = useLocale();
  const { business, branch } = result;
  const hours = { is24h: branch.is24h, weekly: branch.weekly, exceptions: branch.exceptions };
  // Closed (or hours unknown) but takes emergency calls: "call for emergencies" leads, and
  // the hours follow greyed out, so a red "Closed" doesn't read as "no help here" (UX7).
  const callable = result.emergency === 'callable';
  const emergencyLine = (
    <EmergencyLine
      hours={hours}
      labels={{
        anytime: tListing('emergencies'),
        open: tListing('emergenciesOpen'),
        closed: tListing('emergenciesClosed'),
        unknown: tListing('emergenciesUnknown'),
      }}
    />
  );

  return (
    <li className="flex flex-col gap-2 rounded-2xl border-2 p-4">
      <div className="flex items-start justify-between gap-3">
        <h3
          id={headingId}
          tabIndex={headingId === undefined ? undefined : -1}
          className="min-w-0 text-lg leading-snug font-extrabold text-balance"
        >
          {business.name}
        </h3>
        {result.distanceM !== null && (
          <p className="flex shrink-0 items-center gap-1 pt-0.5 font-bold">
            <MapPin aria-hidden className="size-5 text-muted-foreground" />
            {distanceLabel(result.distanceM, locale)}
          </p>
        )}
      </div>
      <p className="-mt-1 text-pretty text-muted-foreground">{areaLine(branch)}</p>

      {callable && emergencyLine}
      <LiveStatus hours={hours} renderedAt={renderedAt} reach={reachOf(branch)} quiet={callable} />
      {!callable && branch.acceptsEmergencies && branch.phone !== null && emergencyLine}

      {branch.phone === null ? (
        <Link href={branch.path} className={cn(outlineAction, 'mt-2 min-h-14 text-lg')}>
          {t('viewClinic')}
          <span className="sr-only">{` ${business.name}`}</span>
          <ChevronRight aria-hidden className="size-5" />
        </Link>
      ) : (
        <>
          <a href={telLink(branch.phone)} className={cn(primaryAction, 'mt-2 min-h-14 text-lg')}>
            <Phone aria-hidden className="size-6" />
            {tListing('call')}
            <span className="sr-only">{` ${business.name}`}</span>
          </a>
          <Link
            href={branch.path}
            className="inline-flex min-h-11 items-center gap-1 self-start font-semibold text-primary underline underline-offset-4 hover:decoration-2"
          >
            {t('viewClinic')}
            <span className="sr-only">{` ${business.name}`}</span>
            <ChevronRight aria-hidden className="size-4" />
          </Link>
        </>
      )}
    </li>
  );
}

import { BadgeCheck, ChevronRight, MapPin, Phone } from 'lucide-react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { HoursFreshness } from '@/components/hours/open-status';
import { useNow } from '@/components/hours/use-now';
import { EmergencyLine, LiveStatus } from '@/components/listing/live-status';
import { SpeciesLine } from '@/components/listing/species-line';
import { outlineAction, primaryAction } from '@/lib/action-styles';
import { telLink, type ContactReach } from '@/lib/contact-links';
import { distanceLabel } from '@/lib/distance-format';
import { servicePriceLabel } from '@/lib/price-format';
import { priceLabels } from '@/lib/price-labels';
import type { SearchBranch, SearchResult } from '@/lib/public-types';

// One search result (DESIGN UX3): name, area, live status, distance, species, the matched
// service with its price (service searches only), freshness, then Call and View clinic.
// Rendered by ResultList, a Client Component, so "Show more" can add cards in the browser.

export function reachOf(branch: SearchBranch): ContactReach {
  if (branch.phone !== null) return 'call';
  return branch.messenger !== null ? 'message' : 'visit';
}

/**
 * A branch of a business with several branches has its own page one level down
 * (/{province}/{city}/{business}/{branch}, ARCHITECTURE §8): then the card names the branch.
 */
const isOneOfSeveral = (path: string) => path.split('/').filter(Boolean).length === 4;

/**
 * The card's area line: "Balibago, Angeles City", after the branch name when there are
 * several, unless the branch is named after its barangay (then the area already says it).
 */
export function areaLine(branch: SearchBranch): string {
  const area = [branch.barangay?.name, branch.city.name].filter(Boolean).join(', ');
  const named = isOneOfSeveral(branch.path) && branch.name !== branch.barangay?.name;
  return named ? `${branch.name} · ${area}` : area;
}

export function ResultCard({
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
  const prices = priceLabels(useTranslations('Prices'));
  const locale = useLocale();
  const now = useNow();
  const { business, branch } = result;
  const hours = { is24h: branch.is24h, weekly: branch.weekly, exceptions: branch.exceptions };
  const reach = reachOf(branch);
  const service = result.kind === 'service' ? result.services[0] : undefined;
  const moreServices = result.kind === 'service' ? result.services.length - 1 : 0;

  return (
    <li className="flex flex-col gap-2 rounded-2xl border-2 p-4 transition-colors hover:border-primary motion-reduce:transition-none">
      <div className="flex items-start justify-between gap-3">
        <h2
          id={headingId}
          tabIndex={headingId === undefined ? undefined : -1}
          className="min-w-0 text-lg leading-snug font-extrabold text-balance"
        >
          {business.name}
        </h2>
        {result.distanceM !== null && (
          <p className="flex shrink-0 items-center gap-1 pt-0.5 text-sm font-semibold text-muted-foreground">
            <MapPin aria-hidden className="size-4" />
            {distanceLabel(result.distanceM, locale)}
          </p>
        )}
      </div>
      <p className="-mt-1 text-pretty text-muted-foreground">{areaLine(branch)}</p>
      {business.claimStatus === 'verified' && (
        <p className="flex items-center gap-1.5 text-sm font-semibold text-verified">
          <BadgeCheck aria-hidden className="size-5" />
          {t('verified')}
        </p>
      )}

      <LiveStatus hours={hours} renderedAt={renderedAt} reach={reach} />
      {branch.acceptsEmergencies && branch.phone !== null && (
        <EmergencyLine
          hours={hours}
          labels={{
            anytime: tListing('emergencies'),
            open: tListing('emergenciesOpen'),
            closed: tListing('emergenciesClosed'),
            unknown: tListing('emergenciesUnknown'),
          }}
        />
      )}

      {service !== undefined && (
        // A service search shows what matched and its price (UX3, UX10): the reason this card is here.
        <div className="rounded-xl bg-muted px-3 py-2">
          <p className="flex flex-wrap items-baseline justify-between gap-x-3">
            <span className="font-semibold">{service.name}</span>
            <span className="font-bold">
              {servicePriceLabel(service, {
                ...prices,
                // Without a phone, "Call for price" would ask the impossible (UX17).
                callForPrice: reach === 'call' ? prices.callForPrice : prices.productPrice(null),
              })}
            </span>
          </p>
          {moreServices > 0 && (
            <p className="text-sm text-muted-foreground">
              {t('moreServices', { count: moreServices })}
            </p>
          )}
        </div>
      )}

      <SpeciesLine species={branch.species} compact />
      <HoursFreshness
        confirmedAt={branch.hoursConfirmedAt}
        confirmedBy={branch.hoursConfirmedBy}
        now={now}
      />

      <div className="mt-auto flex gap-2 pt-2">
        {branch.phone !== null && (
          <a href={telLink(branch.phone)} className={`${primaryAction} flex-1`}>
            <Phone aria-hidden className="size-5" />
            {tListing('call')}
            <span className="sr-only">{` ${business.name}`}</span>
          </a>
        )}
        <Link href={branch.path} className={`${outlineAction} flex-1`}>
          {t('viewClinic')}
          <span className="sr-only">{` ${business.name}`}</span>
          <ChevronRight aria-hidden className="size-5" />
        </Link>
      </div>
    </li>
  );
}

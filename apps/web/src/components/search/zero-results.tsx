import { ChevronRight, SearchX } from 'lucide-react';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import type { Taxonomy } from '@/lib/public-types';
import { activeFilters, widerRadius } from '@/lib/search-filters';
import { firstPage, searchHref, type SearchState } from '@/lib/search-href';
import { NightEmergencyLink } from './night-emergency-link';

const offerLink =
  'inline-flex min-h-11 items-center gap-1 font-semibold text-primary underline underline-offset-4 hover:decoration-2';

/**
 * Nothing matched: never a dead end (DESIGN UX12). It offers what could find something: a
 * wider radius, the search without each filter or without the words, all areas instead of
 * one city, and at night the emergency clinics. The query is already in the search log.
 */
export async function ZeroResults({ state, taxonomy }: { state: SearchState; taxonomy: Taxonomy }) {
  const t = await getTranslations('Search');
  const base = firstPage(state);
  const wider = widerRadius(state);
  const filters = activeFilters(state, taxonomy);
  const offerLabel = (filter: (typeof filters)[number]) => {
    if (filter.kind === 'query') return t('zero.dropQuery', { q: filter.name ?? '' });
    const name =
      filter.name ?? (filter.kind === 'emergency' ? t('emergencyFilter') : t('openNowFilter'));
    return t('zero.dropFilter', { name });
  };

  const offers: { href: string; label: string }[] = [
    ...(wider === null ? [] : [{ href: wider.href, label: t('zero.widen', { km: wider.km }) }]),
    ...filters.map((filter) => ({ href: filter.href, label: offerLabel(filter) })),
    ...(state.location.kind === 'city'
      ? [{ href: searchHref({ ...base, location: { kind: 'all' } }), label: t('zero.allAreas') }]
      : []),
  ];

  return (
    <div className="flex flex-col gap-3 rounded-2xl border-2 p-5">
      <p className="flex items-center gap-2 text-lg font-extrabold">
        <SearchX aria-hidden className="size-6 shrink-0 text-muted-foreground" />
        {t('zero.title')}
      </p>
      <p>{t('zero.hint')}</p>
      <ul className="flex flex-col gap-1">
        {offers.map((offer) => (
          <li key={offer.href}>
            <Link href={offer.href} className={offerLink}>
              {offer.label}
              <ChevronRight aria-hidden className="size-4 shrink-0" />
            </Link>
          </li>
        ))}
        {state.emergency !== true && (
          <NightEmergencyLink
            href={searchHref({ location: state.location, emergency: true })}
            label={t('zero.emergency')}
          />
        )}
      </ul>
    </div>
  );
}

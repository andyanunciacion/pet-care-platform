import { ChevronRight, HeartPulse } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { EmergencyLocation } from '@/components/search/emergency-location';
import { FocusOnArrival } from '@/components/search/focus-on-arrival';
import { LinkPending } from '@/components/search/pending';
import { ResultList } from '@/components/search/result-list';
import { SearchMessages } from '@/components/search/search-messages';
import { apiClient } from '@/lib/api';
import { loadCities } from '@/lib/search-data';
import { widerRadius } from '@/lib/search-filters';
import { apiQuery, emergencyHref, searchHref, type SearchState } from '@/lib/search-href';
import { parseSearchParams } from '@/lib/search-params';
import { cn } from '@/lib/utils';

// The emergency view (DESIGN UX7, principle 7 "calm in emergencies"): branches open now,
// nearest first, then those closed (or with unknown hours) that take emergency calls and
// have a phone. Only the place matters: no search box, no filters. Rendered per request and
// never cached, like /search (ARCHITECTURE D46): what's open depends on the time.

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Emergency');
  return { title: t('metaTitle'), robots: { index: false, follow: true } };
}

const offerLink =
  'inline-flex min-h-11 items-center gap-1 font-semibold text-primary underline underline-offset-4 hover:decoration-2';

/** A link's arrow, a spinner while its page loads (there's no loading.tsx, see pending.tsx). */
const chevron = (
  <LinkPending className="size-4">
    <ChevronRight aria-hidden className="size-4 shrink-0" />
  </LinkPending>
);

export default async function EmergencyPage({ searchParams }: Props) {
  const t = await getTranslations('Emergency');
  const tSearch = await getTranslations('Search');
  // Words and filters in the URL (from the home form without JavaScript) are ignored.
  const { location, cursor } = parseSearchParams(await searchParams);
  const state: SearchState = { location, emergency: true };
  const [cities, search] = await Promise.all([
    loadCities(),
    apiClient()
      .GET('/v1/search', {
        params: { query: apiQuery({ ...state, ...(cursor !== undefined && { cursor }) }) },
      })
      .catch(() => ({ data: undefined })),
  ]);
  const renderedAt = new Date().toISOString();
  // Remounts the location line on every new place, so it starts from the URL again.
  const key = emergencyHref(location);
  const cityName =
    location.kind === 'city'
      ? (cities.cities.find((city) => city.code === location.code)?.name ?? tSearch('thisCity'))
      : '';
  const wider = widerRadius(location);

  return (
    <SearchMessages>
      <div className="flex flex-col gap-6">
        <header className="flex flex-col gap-3 border-b-2 pb-4">
          <h1 className="flex items-center gap-2 text-[length:clamp(1.75rem,1.3rem+2vw,2.5rem)] leading-tight font-extrabold tracking-tight text-emergency">
            <HeartPulse aria-hidden className="size-8 shrink-0" />
            {t('title')}
          </h1>
          <p className="text-lg font-semibold">{t('callFirst')}</p>
          <EmergencyLocation
            key={key}
            location={location}
            cities={cities.cities}
            defaultCityCode={cities.defaultCode}
          />
        </header>

        <div id="emergency-results" className="flex flex-col gap-6">
          <FocusOnArrival key={`focus-${key}`} targetId="emergency-results" />
          {search.data === undefined ? (
            <div role="alert" className="flex flex-col gap-2 rounded-2xl border-2 p-5">
              <p className="text-lg font-extrabold">{tSearch('loadFailed')}</p>
              <Link href={key} className={offerLink}>
                {tSearch('tryAgain')}
              </Link>
            </div>
          ) : search.data.results.length === 0 ? (
            <div className="flex flex-col gap-3 rounded-2xl border-2 p-5">
              <h2 className="text-lg font-extrabold">
                {t('none', { where: location.kind, city: cityName })}
              </h2>
              {location.kind !== 'all' && (
                <>
                  <p>{t('noneHint')}</p>
                  <ul className="flex flex-col gap-1">
                    {wider !== null && (
                      <li>
                        <Link href={emergencyHref(wider.location)} className={offerLink}>
                          {t('widen', { km: wider.km })}
                          {chevron}
                        </Link>
                      </li>
                    )}
                    {/* Near the owner too: far is better than a dead end at night (UX12). */}
                    <li>
                      <Link href={emergencyHref({ kind: 'all' })} className={offerLink}>
                        {t('allAreas')}
                        {chevron}
                      </Link>
                    </li>
                  </ul>
                </>
              )}
            </div>
          ) : (
            <ResultList
              key={`results-${key}`}
              initial={search.data.results}
              initialCursor={search.data.nextCursor}
              state={state}
              query={apiQuery(state)}
              renderedAt={renderedAt}
              view="emergency"
            />
          )}
        </div>

        <Link href={searchHref({ location })} className={cn(offerLink, 'self-start')}>
          {t('searchAll')}
          {chevron}
        </Link>
      </div>
    </SearchMessages>
  );
}

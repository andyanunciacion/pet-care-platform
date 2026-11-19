import { HeartPulse } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { ActiveFilters } from '@/components/search/active-filters';
import { FilterButton, FilterSheet } from '@/components/search/filter-sheet';
import { ResultList } from '@/components/search/result-list';
import { SearchForm } from '@/components/search/search-form';
import { SearchMessages } from '@/components/search/search-messages';
import { ZeroResults } from '@/components/search/zero-results';
import { apiClient } from '@/lib/api';
import { loadCities, loadTaxonomy } from '@/lib/search-data';
import { activeFilters } from '@/lib/search-filters';
import { apiQuery, searchHref } from '@/lib/search-href';
import { parseSearchParams } from '@/lib/search-params';

// Search results (DESIGN UX2, UX3, UX12): the list, filters and "nothing found" offers. The
// map arrives with P1-5c. Rendered per request and never cached: results depend on the time
// ("open now") and on the search (ARCHITECTURE D46).

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const t = await getTranslations('Search');
  const { q } = parseSearchParams(await searchParams);
  return {
    title: q === undefined ? t('metaTitle') : t('metaTitleQuery', { q }),
    // Internal search pages stay out of search engines; the city and service landing pages
    // (P1-6) are the indexable ones. "follow" lets crawlers still reach the clinic pages.
    robots: { index: false, follow: true },
  };
}

export default async function SearchPage({ searchParams }: Props) {
  const t = await getTranslations('Search');
  const state = parseSearchParams(await searchParams);
  const [taxonomy, cities, search] = await Promise.all([
    loadTaxonomy(),
    loadCities(),
    // A network failure shows the "couldn't load" message, like an error answer does.
    apiClient()
      .GET('/v1/search', { params: { query: apiQuery(state) } })
      .catch(() => ({ data: undefined })),
  ]);
  const renderedAt = new Date().toISOString();
  const filters = activeFilters(state, taxonomy);
  // Remounts the form and the filter sheet on every new search, so their state (typed text,
  // an open sheet) starts from the URL again.
  const key = searchHref({ ...state, cursor: undefined });
  const { location } = state;
  const cityName =
    location.kind === 'city'
      ? (cities.cities.find((city) => city.code === location.code)?.name ?? t('thisCity'))
      : '';

  return (
    <SearchMessages>
      <div className="flex flex-col gap-6">
        <SearchForm
          key={`form-${key}`}
          initial={state}
          cities={cities.cities}
          defaultCityCode={cities.defaultCode}
        />

        <div className="flex flex-wrap items-center gap-2">
          <FilterButton
            // What the sheet sets: animal, service, open now (not the words or Emergency).
            active={
              filters.filter((filter) => ['species', 'category', 'openNow'].includes(filter.kind))
                .length
            }
          />
          {state.emergency !== true && (
            <Link
              href={searchHref({ location, emergency: true })}
              className="inline-flex min-h-12 items-center gap-1.5 rounded-xl border-2 border-emergency bg-background px-4 font-bold text-emergency transition-colors duration-150 hover:bg-muted active:translate-y-px motion-reduce:transition-none"
            >
              <HeartPulse aria-hidden className="size-5" />
              {t('chips.emergency')}
            </Link>
          )}
          <ActiveFilters filters={filters} />
        </div>
        <FilterSheet key={`filters-${key}`} state={state} taxonomy={taxonomy} />

        <section aria-labelledby="results-title" className="flex flex-col gap-4">
          {search.data === undefined ? (
            <div role="alert" className="flex flex-col gap-2 rounded-2xl border-2 p-5">
              <h1 id="results-title" className="text-lg font-extrabold">
                {t('loadFailed')}
              </h1>
              <Link
                href={key}
                className="font-semibold text-primary underline underline-offset-4 hover:decoration-2"
              >
                {t('tryAgain')}
              </Link>
            </div>
          ) : (
            <>
              <div className="flex flex-col gap-1 border-b-2 pb-3">
                <h1 id="results-title" className="text-2xl font-extrabold tracking-tight">
                  {t('resultsTitle', {
                    count: search.data.total,
                    where: location.kind,
                    city: cityName,
                  })}
                </h1>
                {state.q !== undefined && search.data.matchedCategories.length > 0 && (
                  <p className="text-muted-foreground">
                    {t('matched', {
                      categories: search.data.matchedCategories
                        .map((category) => category.name)
                        .join(', '),
                      q: state.q,
                    })}
                  </p>
                )}
              </div>
              {search.data.results.length === 0 ? (
                <ZeroResults state={state} taxonomy={taxonomy} />
              ) : (
                <ResultList
                  key={`results-${key}`}
                  initial={search.data.results}
                  initialCursor={search.data.nextCursor}
                  state={state}
                  query={apiQuery({ ...state, cursor: undefined })}
                  renderedAt={renderedAt}
                />
              )}
            </>
          )}
        </section>
      </div>
    </SearchMessages>
  );
}

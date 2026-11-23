'use client';

import { LoaderCircle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useState, type MouseEvent } from 'react';
import { outlineAction } from '@/lib/action-styles';
import { browserApi } from '@/lib/browser-api';
import type { SearchApiQuery, SearchResult } from '@/lib/public-types';
import { emergencyHref, searchHref, type SearchState } from '@/lib/search-href';
import { EmergencyCard } from './emergency-card';
import { ResultCard } from './result-card';

/**
 * The results, then "Show more results". The button is a link to the next page, so it works
 * without JavaScript (that page shows only the next results); with it, the next results are
 * added below the ones already shown and focus moves to the first new one.
 *
 * The emergency view (UX7) shows them in two groups: open now, then closed but taking
 * emergency calls. The API sends them in that order; the group is decided when the page is
 * rendered, which is fine since it's never cached (ARCHITECTURE D46).
 */
export function ResultList({
  initial,
  initialCursor,
  state,
  query,
  renderedAt,
  view = 'search',
}: {
  initial: SearchResult[];
  initialCursor: string | null;
  /** The search as shown in the URL, for the no-JavaScript link. */
  state: SearchState;
  /** The same search as the API takes it, without a cursor. */
  query: SearchApiQuery;
  renderedAt: string;
  view?: 'search' | 'emergency';
}) {
  const t = useTranslations('Search');
  const tEmergency = useTranslations('Emergency');
  const [results, setResults] = useState(initial);
  const [cursor, setCursor] = useState(initialCursor);
  const [status, setStatus] = useState<'idle' | 'loading' | 'failed'>('idle');
  const [firstNew, setFirstNew] = useState<number | null>(null);

  useEffect(() => {
    if (firstNew === null) return;
    document.getElementById(`result-${String(firstNew)}`)?.focus();
  }, [firstNew]);

  const showMore = async (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    if (cursor === null || status === 'loading') return;
    setStatus('loading');
    const { data } = await browserApi
      .GET('/v1/search', { params: { query: { ...query, cursor } } })
      .catch(() => ({ data: undefined }));
    if (data === undefined) {
      setStatus('failed');
      return;
    }
    setFirstNew(results.length);
    setResults([...results, ...data.results]);
    setCursor(data.nextCursor);
    setStatus('idle');
  };

  // Each card keeps its index in `results`, so focus finds the first new one in either group.
  const indexed = results.map((result, index) => ({ result, index }));
  const nextHref =
    cursor === null
      ? null
      : view === 'emergency'
        ? emergencyHref(state.location, cursor)
        : searchHref({ ...state, cursor });

  return (
    <div className="flex flex-col gap-4">
      {view === 'search' ? (
        <ul className="grid gap-4 md:grid-cols-2">
          {indexed.map(({ result, index }) => (
            <ResultCard
              key={result.branch.id}
              result={result}
              renderedAt={renderedAt}
              headingId={`result-${String(index)}`}
            />
          ))}
        </ul>
      ) : (
        (['open', 'callable'] as const).map((group) => {
          const cards = indexed.filter(
            ({ result }) => (result.emergency === 'callable' ? 'callable' : 'open') === group,
          );
          if (cards.length === 0) return null;
          return (
            <section
              key={group}
              aria-labelledby={`emergency-${group}`}
              className="flex flex-col gap-3"
            >
              <h2 id={`emergency-${group}`} className="text-xl font-extrabold">
                {tEmergency(group === 'open' ? 'openGroup' : 'callableGroup')}
              </h2>
              <ul className="grid gap-4 md:grid-cols-2">
                {cards.map(({ result, index }) => (
                  <EmergencyCard
                    key={result.branch.id}
                    result={result}
                    renderedAt={renderedAt}
                    headingId={`result-${String(index)}`}
                  />
                ))}
              </ul>
            </section>
          );
        })
      )}
      {status === 'failed' && (
        <p role="alert" className="text-status-closed">
          {t('moreFailed')}
        </p>
      )}
      {nextHref !== null && (
        <a
          href={nextHref}
          onClick={(event) => void showMore(event)}
          aria-disabled={status === 'loading'}
          className={`${outlineAction} self-center px-6`}
        >
          {status === 'loading' ? (
            <>
              <LoaderCircle
                aria-hidden
                className="size-5 animate-spin motion-reduce:animate-none"
              />
              {t('loadingMore')}
            </>
          ) : (
            t('showMore')
          )}
        </a>
      )}
    </div>
  );
}

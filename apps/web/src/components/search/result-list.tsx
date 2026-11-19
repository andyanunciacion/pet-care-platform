'use client';

import { LoaderCircle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useState, type MouseEvent } from 'react';
import { outlineAction } from '@/lib/action-styles';
import { browserApi } from '@/lib/browser-api';
import type { SearchApiQuery, SearchResult } from '@/lib/public-types';
import { searchHref, type SearchState } from '@/lib/search-href';
import { ResultCard } from './result-card';

/**
 * The results, then "Show more results". The button is a link to the next page, so it works
 * without JavaScript (that page shows only the next results); with it, the next results are
 * added below the ones already shown and focus moves to the first new one.
 */
export function ResultList({
  initial,
  initialCursor,
  state,
  query,
  renderedAt,
}: {
  initial: SearchResult[];
  initialCursor: string | null;
  /** The search as shown in the URL, for the no-JavaScript link. */
  state: SearchState;
  /** The same search as the API takes it, without a cursor. */
  query: SearchApiQuery;
  renderedAt: string;
}) {
  const t = useTranslations('Search');
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

  return (
    <div className="flex flex-col gap-4">
      <ul className="grid gap-4 md:grid-cols-2">
        {results.map((result, index) => (
          <ResultCard
            key={result.branch.id}
            result={result}
            renderedAt={renderedAt}
            headingId={`result-${String(index)}`}
          />
        ))}
      </ul>
      {status === 'failed' && (
        <p role="alert" className="text-status-closed">
          {t('moreFailed')}
        </p>
      )}
      {cursor !== null && (
        <a
          href={searchHref({ ...state, cursor })}
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

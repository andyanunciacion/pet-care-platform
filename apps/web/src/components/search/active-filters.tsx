import { X } from 'lucide-react';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import type { ActiveFilter } from '@/lib/search-filters';

/** The words and filters in use as removable chips ("“kapon” ×", "Rabbit ×"), each a link to the search without it. */
export async function ActiveFilters({ filters }: { filters: ActiveFilter[] }) {
  if (filters.length === 0) return null;
  const t = await getTranslations('Search');
  const label = (filter: ActiveFilter) => {
    if (filter.kind === 'query') return t('queryFilter', { q: filter.name ?? '' });
    return filter.name ?? (filter.kind === 'emergency' ? t('emergencyFilter') : t('openNowFilter'));
  };

  return (
    <ul aria-label={t('activeFilters')} className="flex flex-wrap gap-2">
      {filters.map((filter) => (
        <li key={filter.kind}>
          <Link
            href={filter.href}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border-2 border-primary bg-muted px-3 font-semibold text-primary transition-colors duration-150 hover:bg-background active:translate-y-px motion-reduce:transition-none"
          >
            {label(filter)}
            <X aria-hidden className="size-4" />
            <span className="sr-only">{`: ${t('removeFilter')}`}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

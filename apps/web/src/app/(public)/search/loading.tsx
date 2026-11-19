import { LoaderCircle } from 'lucide-react';
import { getTranslations } from 'next-intl/server';

/** Shown at once while a new search loads (the results are fetched on every request). */
export default async function SearchLoading() {
  const t = await getTranslations('Search');
  return (
    <p role="status" className="flex items-center gap-2 py-8 text-lg font-semibold">
      <LoaderCircle aria-hidden className="size-6 animate-spin motion-reduce:animate-none" />
      {t('searching')}
    </p>
  );
}

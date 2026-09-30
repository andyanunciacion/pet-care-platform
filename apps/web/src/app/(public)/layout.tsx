import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';
import { Wordmark } from '@/components/wordmark';

// Public pages for pet owners: indexable, mobile-first (DESIGN.md §4).
// "(public)" is a route group: it shares this layout without adding "/public" to URLs.
export default async function PublicLayout({ children }: { children: ReactNode }) {
  const t = await getTranslations('Header');
  return (
    <>
      <header className="border-b">
        <div className="mx-auto flex h-14 max-w-5xl items-center px-4">
          <Link href="/" aria-label={t('homeLink')} className="rounded-md">
            <Wordmark />
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
    </>
  );
}

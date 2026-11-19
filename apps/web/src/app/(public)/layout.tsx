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
      {/* The booklet's cover: a blue band with the pink binding strip under it (DESIGN §7.1). */}
      <header className="border-b-[6px] border-binding bg-primary">
        <div className="mx-auto flex h-15 max-w-5xl items-center px-4">
          <Link
            href="/"
            aria-label={t('homeLink')}
            // White focus ring: the default blue one would vanish on the blue band.
            className="inline-flex min-h-11 items-center rounded-md focus-visible:outline-primary-foreground"
          >
            <Wordmark onPrimary />
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
    </>
  );
}

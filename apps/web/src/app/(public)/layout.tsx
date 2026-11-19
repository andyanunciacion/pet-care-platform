import { Search } from 'lucide-react';
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
        <div className="mx-auto flex h-15 max-w-5xl items-center justify-between gap-4 px-4">
          <Link
            href="/"
            aria-label={t('homeLink')}
            // White focus ring: the default blue one would vanish on the blue band.
            className="inline-flex min-h-11 items-center rounded-md focus-visible:outline-primary-foreground"
          >
            <Wordmark onPrimary />
          </Link>
          {/* The cover's one action (DESIGN §7.1): white on the band, so it reads as a button. */}
          <Link
            href="/search"
            className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-primary-foreground px-3 font-bold text-primary transition-[filter] duration-150 hover:brightness-95 active:translate-y-px motion-reduce:transition-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-foreground"
          >
            <Search aria-hidden className="size-5" />
            {t('findVet')}
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
    </>
  );
}

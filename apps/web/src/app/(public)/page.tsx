import { getTranslations } from 'next-intl/server';
import { Suspense } from 'react';
import { ApiStatus, ApiStatusPending } from '@/components/api-status';

// Walking-skeleton home page. The real search-first home arrives with slice 5 (DESIGN.md UX1).
export default async function HomePage() {
  const t = await getTranslations();
  return (
    <div className="flex flex-col gap-8">
      {/* A soft muted band groups the intro: tint before shadow (DESIGN.md §7). */}
      <section className="flex flex-col gap-3 rounded-2xl bg-muted px-6 py-12 md:px-12 md:py-18">
        <h1 className="text-[length:clamp(2rem,1.3rem+3vw,3rem)] leading-[1.08] font-extrabold tracking-[-0.03em] text-balance">
          {t('Home.title')}
        </h1>
        <p className="max-w-[40ch]">{t('Home.subtitle')}</p>
      </section>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-5 text-muted-foreground">
        <span>{t('ApiStatus.title')}</span>
        {/* The page shell renders immediately; the status streams in when the API answers. */}
        <Suspense fallback={<ApiStatusPending />}>
          <ApiStatus />
        </Suspense>
      </div>
    </div>
  );
}

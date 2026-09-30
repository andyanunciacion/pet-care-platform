import { getTranslations } from 'next-intl/server';
import { Suspense } from 'react';
import { ApiStatus, ApiStatusPending } from '@/components/api-status';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

// Walking-skeleton home page. The real search-first home arrives with slice 5 (DESIGN.md UX1).
export default async function HomePage() {
  const t = await getTranslations();
  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">{t('Home.title')}</h1>
        <p className="text-muted-foreground">{t('Home.subtitle')}</p>
      </section>

      <Card className="max-w-md text-base">
        <CardHeader>
          <CardTitle>{t('ApiStatus.title')}</CardTitle>
        </CardHeader>
        <CardContent>
          {/* The page shell renders immediately; the status streams in when the API answers. */}
          <Suspense fallback={<ApiStatusPending />}>
            <ApiStatus />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  );
}

import type { Metadata } from 'next';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { z } from 'zod';
import { AuditTrail } from '@/components/admin/audit-trail';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import { adminApi, dataOrThrow } from '@/lib/admin-api';
import { requireAdmin } from '@/lib/admin-session';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('AdminAudit');
  return { title: t('title') };
}

const ENTITY_TYPES = ['business', 'branch', 'user'] as const;

// Filters and the page cursor live in the URL; anything malformed is ignored.
const QuerySchema = z.object({
  entityType: z.enum(ENTITY_TYPES).optional().catch(undefined),
  businessId: z.uuid().optional().catch(undefined),
  before: z.uuid().optional().catch(undefined),
});

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin();
  const query = QuerySchema.parse(await searchParams);
  const [t, api] = await Promise.all([getTranslations('AdminAudit'), adminApi()]);
  const page = await api
    .GET('/v1/admin/audit-log', { params: { query: { ...query, limit: 50 } } })
    .then(dataOrThrow);

  const hrefWith = (before?: string) => {
    const params = new URLSearchParams();
    if (query.entityType !== undefined) params.set('entityType', query.entityType);
    if (query.businessId !== undefined) params.set('businessId', query.businessId);
    if (before !== undefined) params.set('before', before);
    const search = params.toString();
    return search === '' ? '/admin/audit-log' : `/admin/audit-log?${search}`;
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold">{t('title')}</h1>
        <p className="text-muted-foreground">{t('subtitle')}</p>
      </div>

      {query.businessId === undefined ? (
        <form
          method="get"
          aria-label={t('filtersLabel')}
          className="flex flex-wrap items-end gap-3 rounded-lg border p-4"
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="entityType">{t('entityType')}</Label>
            <NativeSelect id="entityType" name="entityType" defaultValue={query.entityType ?? ''}>
              <NativeSelectOption value="">{t('anyEntity')}</NativeSelectOption>
              {ENTITY_TYPES.map((type) => (
                <NativeSelectOption key={type} value={type}>
                  {t(`entityTypes.${type}`)}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
          <Button type="submit">{t('apply')}</Button>
        </form>
      ) : (
        <p className="text-sm text-muted-foreground">
          {t('filteredToBusiness')}{' '}
          <Link href="/admin/audit-log" className="text-primary hover:underline">
            {t('showAll')}
          </Link>
        </p>
      )}

      <AuditTrail entries={page.items} />

      {(query.before !== undefined || page.nextBefore !== null) && (
        <nav aria-label={t('pagination')} className="flex items-center justify-between text-sm">
          {query.before !== undefined ? (
            <Link href={hrefWith()} className="hover:underline">
              {t('newest')}
            </Link>
          ) : (
            <span />
          )}
          {page.nextBefore !== null && (
            <Link href={hrefWith(page.nextBefore)} className="hover:underline">
              {t('older')}
            </Link>
          )}
        </nav>
      )}
    </div>
  );
}

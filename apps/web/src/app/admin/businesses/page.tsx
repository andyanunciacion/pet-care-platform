import type { Metadata } from 'next';
import Link from 'next/link';
import { getFormatter, getTranslations } from 'next-intl/server';
import { z } from 'zod';
import { ClaimStatusBadge, ListingStatusBadge } from '@/components/admin/status-badges';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  NativeSelect,
  NativeSelectOptGroup,
  NativeSelectOption,
} from '@/components/ui/native-select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { adminApi, dataOrThrow } from '@/lib/admin-api';
import { requireAdmin } from '@/lib/admin-session';
import { CLAIM_STATUSES, LISTING_STATUSES } from '@/lib/admin-types';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('AdminListings');
  return { title: t('title') };
}

const PAGE_SIZE = 50;

// Filters live in the URL (?q=&cityCode=…), so a filtered view can be bookmarked, and the
// filter form is a plain GET form that works without JavaScript. Anything malformed is
// ignored rather than failing the page.
const FiltersSchema = z.object({
  q: z.string().trim().max(100).optional().catch(undefined),
  cityCode: z
    .string()
    .regex(/^[0-9]{10}$/)
    .optional()
    .catch(undefined),
  claimStatus: z.enum(CLAIM_STATUSES).optional().catch(undefined),
  listingStatus: z.enum(LISTING_STATUSES).optional().catch(undefined),
  page: z.coerce.number().int().min(1).optional().catch(undefined),
});

type Filters = z.infer<typeof FiltersSchema>;

function hrefWith(filters: Filters, page: number): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries({ ...filters, page: page === 1 ? undefined : page })) {
    if (value !== undefined && value !== '') params.set(key, String(value));
  }
  const query = params.toString();
  return query === '' ? '/admin/businesses' : `/admin/businesses?${query}`;
}

export default async function ListingsPage({ searchParams }: PageProps<'/admin/businesses'>) {
  await requireAdmin();
  const filters = FiltersSchema.parse(await searchParams);
  const page = filters.page ?? 1;
  const [t, tEnums, format, api] = await Promise.all([
    getTranslations('AdminListings'),
    getTranslations('Enums'),
    getFormatter(),
    adminApi(),
  ]);

  const [list, provinces] = await Promise.all([
    api
      .GET('/v1/admin/businesses', {
        params: { query: { ...filters, page, pageSize: PAGE_SIZE } },
      })
      .then(dataOrThrow),
    api.GET('/v1/admin/psgc-areas').then(dataOrThrow),
  ]);
  // The city filter lists every city in every province PAW has loaded (Pampanga for now).
  const citiesByProvince = await Promise.all(
    provinces.map(async (province) => ({
      province,
      cities: await api
        .GET('/v1/admin/psgc-areas', { params: { query: { parentCode: province.code } } })
        .then(dataOrThrow),
    })),
  );
  const pages = Math.max(1, Math.ceil(list.total / PAGE_SIZE));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">{t('title')}</h1>
        <Button asChild>
          <Link href="/admin/businesses/new">{t('newBusiness')}</Link>
        </Button>
      </div>

      <form
        method="get"
        aria-label={t('filtersLabel')}
        className="flex flex-wrap items-end gap-3 rounded-lg border p-4"
      >
        <div className="flex min-w-64 flex-1 flex-col gap-1.5">
          <Label htmlFor="q">{t('search')}</Label>
          <Input
            id="q"
            name="q"
            type="search"
            defaultValue={filters.q}
            placeholder={t('searchPlaceholder')}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="cityCode">{t('city')}</Label>
          <NativeSelect id="cityCode" name="cityCode" defaultValue={filters.cityCode ?? ''}>
            <NativeSelectOption value="">{t('anyCity')}</NativeSelectOption>
            {citiesByProvince.map(({ province, cities }) => (
              <NativeSelectOptGroup key={province.code} label={province.name}>
                {cities.map((city) => (
                  <NativeSelectOption key={city.code} value={city.code}>
                    {city.name}
                  </NativeSelectOption>
                ))}
              </NativeSelectOptGroup>
            ))}
          </NativeSelect>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="claimStatus">{t('claimStatus')}</Label>
          <NativeSelect
            id="claimStatus"
            name="claimStatus"
            defaultValue={filters.claimStatus ?? ''}
          >
            <NativeSelectOption value="">{t('any')}</NativeSelectOption>
            {CLAIM_STATUSES.map((status) => (
              <NativeSelectOption key={status} value={status}>
                {tEnums(`claimStatus.${status}`)}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="listingStatus">{t('listingStatus')}</Label>
          <NativeSelect
            id="listingStatus"
            name="listingStatus"
            defaultValue={filters.listingStatus ?? ''}
          >
            <NativeSelectOption value="">{t('any')}</NativeSelectOption>
            {LISTING_STATUSES.map((status) => (
              <NativeSelectOption key={status} value={status}>
                {tEnums(`listingStatus.${status}`)}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
        <Button type="submit">{t('apply')}</Button>
        <Button variant="ghost" asChild>
          <Link href="/admin/businesses">{t('clear')}</Link>
        </Button>
      </form>

      <p className="text-sm text-muted-foreground" aria-live="polite">
        {t('results', { total: list.total })}
      </p>

      {list.items.length === 0 ? (
        <p className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
          {t('empty')}
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('columns.name')}</TableHead>
              <TableHead>{t('columns.cities')}</TableHead>
              <TableHead className="text-right">{t('columns.branches')}</TableHead>
              <TableHead>{t('columns.claim')}</TableHead>
              <TableHead>{t('columns.listing')}</TableHead>
              <TableHead>{t('columns.updated')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.items.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="font-medium">
                  <Link href={`/admin/businesses/${item.id}`} className="hover:underline">
                    {item.name}
                  </Link>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {item.cities.length === 0
                    ? t('noBranches')
                    : item.cities.map((city) => city.name).join(', ')}
                </TableCell>
                <TableCell className="text-right tabular-nums">{item.branchCount}</TableCell>
                <TableCell>
                  <ClaimStatusBadge
                    status={item.claimStatus}
                    label={tEnums(`claimStatus.${item.claimStatus}`)}
                  />
                </TableCell>
                <TableCell>
                  <ListingStatusBadge
                    status={item.listingStatus}
                    label={tEnums(`listingStatus.${item.listingStatus}`)}
                  />
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {format.dateTime(new Date(item.updatedAt), { dateStyle: 'medium' })}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {pages > 1 && (
        <nav aria-label={t('pagination')} className="flex items-center justify-between text-sm">
          {page > 1 ? (
            <Link href={hrefWith(filters, page - 1)} className="hover:underline">
              {t('previous')}
            </Link>
          ) : (
            <span />
          )}
          <span className="text-muted-foreground">{t('page', { page, pages })}</span>
          {page < pages ? (
            <Link href={hrefWith(filters, page + 1)} className="hover:underline">
              {t('next')}
            </Link>
          ) : (
            <span />
          )}
        </nav>
      )}
    </div>
  );
}

import type { Metadata } from 'next';
import Link from 'next/link';
import { getFormatter, getTranslations } from 'next-intl/server';
import { cache } from 'react';
import { AuditTrail } from '@/components/admin/audit-trail';
import { BusinessForm } from '@/components/admin/business-form';
import { AdminFormMessages } from '@/components/admin/form-messages';
import { ProductsEditor } from '@/components/admin/products-editor';
import { ListingStatusBadge } from '@/components/admin/status-badges';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { adminApi, dataOrNotFound, dataOrThrow } from '@/lib/admin-api';
import { requireAdmin } from '@/lib/admin-session';

// cache(): generateMetadata and the page share one API call per request.
const getBusiness = cache(async (id: string) => {
  const api = await adminApi();
  return dataOrNotFound(await api.GET('/v1/admin/businesses/{id}', { params: { path: { id } } }));
});

// Typed by hand rather than with Next's generated PageProps: that global type only exists
// after `next typegen`, which CI's lint job doesn't run.
interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  await requireAdmin();
  return { title: (await getBusiness((await params).id)).name };
}

export default async function BusinessPage({ params }: Props) {
  await requireAdmin();
  const business = await getBusiness((await params).id);
  const api = await adminApi();
  const [t, tAudit, tEnums, format, products, history] = await Promise.all([
    getTranslations('AdminBusiness'),
    getTranslations('AdminAudit'),
    getTranslations('Enums'),
    getFormatter(),
    api
      .GET('/v1/admin/businesses/{id}/products', { params: { path: { id: business.id } } })
      .then(dataOrThrow),
    // The business and all its branches, newest first.
    api
      .GET('/v1/admin/audit-log', { params: { query: { businessId: business.id, limit: 10 } } })
      .then(dataOrThrow),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <Link href="/admin/businesses" className="text-sm text-muted-foreground hover:underline">
          {t('backToListings')}
        </Link>
        <h1 className="text-2xl font-bold">{business.name}</h1>
      </div>

      <AdminFormMessages>
        <BusinessForm business={business} />
      </AdminFormMessages>

      <section aria-labelledby="branches" className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-4">
          <h2 id="branches" className="text-xl font-semibold">
            {t('branches')}
          </h2>
          <Button asChild variant="outline">
            <Link href={`/admin/businesses/${business.id}/branches/new`}>{t('addBranch')}</Link>
          </Button>
        </div>
        {business.branches.length === 0 ? (
          <p className="rounded-lg border border-dashed p-6 text-muted-foreground">
            {t('noBranches')}
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('columns.name')}</TableHead>
                <TableHead>{t('columns.address')}</TableHead>
                <TableHead>{t('columns.listing')}</TableHead>
                <TableHead>{t('columns.updated')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {business.branches.map((branch) => (
                <TableRow key={branch.id}>
                  <TableCell className="font-medium">
                    <Link
                      href={`/admin/businesses/${business.id}/branches/${branch.id}`}
                      className="hover:underline"
                    >
                      {branch.name}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {branch.addressLine}, {branch.city.name}
                  </TableCell>
                  <TableCell>
                    <ListingStatusBadge
                      status={branch.listingStatus}
                      label={tEnums(`listingStatus.${branch.listingStatus}`)}
                    />
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {format.dateTime(new Date(branch.updatedAt), { dateStyle: 'medium' })}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>

      <AdminFormMessages extra={['AdminProducts', 'Prices']}>
        <ProductsEditor businessId={business.id} products={products} />
      </AdminFormMessages>

      <section aria-labelledby="history" className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-4">
          <h2 id="history" className="text-xl font-semibold">
            {tAudit('history')}
          </h2>
          {history.nextBefore !== null && (
            <Link
              href={`/admin/audit-log?businessId=${business.id}`}
              className="text-sm text-primary hover:underline"
            >
              {tAudit('fullHistory')}
            </Link>
          )}
        </div>
        <AuditTrail entries={history.items} />
      </section>
    </div>
  );
}

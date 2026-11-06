import type { Metadata } from 'next';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { BranchForm } from '@/components/admin/branch-form';
import { AdminFormMessages } from '@/components/admin/form-messages';
import { adminApi, dataOrNotFound, dataOrThrow } from '@/lib/admin-api';
import { requireAdmin } from '@/lib/admin-session';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('AdminBranch');
  return { title: t('newTitle') };
}

export default async function NewBranchPage({
  params,
}: PageProps<'/admin/businesses/[id]/branches/new'>) {
  await requireAdmin();
  const { id } = await params;
  const api = await adminApi();
  const [t, business, provinces] = await Promise.all([
    getTranslations('AdminBranch'),
    api.GET('/v1/admin/businesses/{id}', { params: { path: { id } } }).then(dataOrNotFound),
    api.GET('/v1/admin/psgc-areas').then(dataOrThrow),
  ]);
  // Start in the only province, so the city list is ready (Pampanga, for now).
  const defaultProvince = provinces.length === 1 ? provinces[0] : undefined;
  const cities =
    defaultProvince === undefined
      ? []
      : await api
          .GET('/v1/admin/psgc-areas', { params: { query: { parentCode: defaultProvince.code } } })
          .then(dataOrThrow);

  return (
    <div className="flex flex-col gap-6">
      <Link
        href={`/admin/businesses/${business.id}`}
        className="text-sm text-muted-foreground hover:underline"
      >
        {t('backToBusiness', { business: business.name })}
      </Link>
      <h1 className="text-2xl font-bold">{t('newTitle')}</h1>
      <AdminFormMessages>
        <BranchForm
          business={business}
          provinces={provinces}
          initialCities={cities}
          initialBarangays={[]}
          {...(defaultProvince !== undefined && { defaultProvinceCode: defaultProvince.code })}
        />
      </AdminFormMessages>
    </div>
  );
}

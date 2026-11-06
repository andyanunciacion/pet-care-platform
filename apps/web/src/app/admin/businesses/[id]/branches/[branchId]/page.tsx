import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { cache } from 'react';
import { BranchForm } from '@/components/admin/branch-form';
import { AdminFormMessages } from '@/components/admin/form-messages';
import { adminApi, dataOrNotFound, dataOrThrow } from '@/lib/admin-api';
import { requireAdmin } from '@/lib/admin-session';

interface Props {
  params: Promise<{ id: string; branchId: string }>;
}

// cache(): generateMetadata and the page share one API call per request.
const getBranch = cache(async (businessId: string, branchId: string) => {
  const api = await adminApi();
  const branch = dataOrNotFound(
    await api.GET('/v1/admin/branches/{id}', { params: { path: { id: branchId } } }),
  );
  // The URL names the business too; a branch of another business is not found here.
  if (branch.business.id !== businessId) notFound();
  return branch;
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  await requireAdmin();
  const { id, branchId } = await params;
  const branch = await getBranch(id, branchId);
  return { title: `${branch.name} · ${branch.business.name}` };
}

export default async function BranchPage({ params }: Props) {
  await requireAdmin();
  const { id, branchId } = await params;
  const branch = await getBranch(id, branchId);
  const api = await adminApi();
  const areas = (parentCode?: string) =>
    api
      .GET('/v1/admin/psgc-areas', {
        params: { query: parentCode === undefined ? {} : { parentCode } },
      })
      .then(dataOrThrow);
  const [t, provinces, cities, barangays] = await Promise.all([
    getTranslations('AdminBranch'),
    areas(),
    areas(branch.province.code),
    areas(branch.city.code),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <Link
        href={`/admin/businesses/${branch.business.id}`}
        className="text-sm text-muted-foreground hover:underline"
      >
        {t('backToBusiness', { business: branch.business.name })}
      </Link>
      <h1 className="text-2xl font-bold">{branch.name}</h1>
      <AdminFormMessages>
        <BranchForm
          business={branch.business}
          branch={branch}
          provinces={provinces}
          initialCities={cities}
          initialBarangays={barangays}
        />
      </AdminFormMessages>
    </div>
  );
}

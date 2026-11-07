import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { cache } from 'react';
import { BranchTabs } from '@/components/admin/branch-tabs';
import { AdminFormMessages } from '@/components/admin/form-messages';
import { ServicesEditor } from '@/components/admin/services-editor';
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
  const [branch, t] = await Promise.all([getBranch(id, branchId), getTranslations('AdminHours')]);
  return { title: `${t('tabServices')} · ${branch.name} · ${branch.business.name}` };
}

export default async function BranchServicesPage({ params }: Props) {
  await requireAdmin();
  const { id, branchId } = await params;
  const api = await adminApi();
  const [branch, services, taxonomy, t] = await Promise.all([
    getBranch(id, branchId),
    api
      .GET('/v1/admin/branches/{id}/services', { params: { path: { id: branchId } } })
      .then(dataOrNotFound),
    api.GET('/v1/admin/taxonomy').then(dataOrThrow),
    getTranslations('AdminBranch'),
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
      <BranchTabs businessId={branch.business.id} branchId={branch.id} current="services" />
      <AdminFormMessages extra={['AdminServices', 'Prices']}>
        <ServicesEditor data={services} taxonomy={taxonomy} />
      </AdminFormMessages>
    </div>
  );
}

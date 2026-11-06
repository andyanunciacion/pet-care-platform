import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { cache } from 'react';
import { BranchTabs } from '@/components/admin/branch-tabs';
import { AdminFormMessages } from '@/components/admin/form-messages';
import { HoursEditor } from '@/components/admin/hours-editor';
import { adminApi, dataOrNotFound } from '@/lib/admin-api';
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
  return { title: `${t('tabHours')} · ${branch.name} · ${branch.business.name}` };
}

export default async function BranchHoursPage({ params }: Props) {
  await requireAdmin();
  const { id, branchId } = await params;
  const api = await adminApi();
  const [branch, hours, t] = await Promise.all([
    getBranch(id, branchId),
    api
      .GET('/v1/admin/branches/{id}/hours', { params: { path: { id: branchId } } })
      .then(dataOrNotFound),
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
      <BranchTabs businessId={branch.business.id} branchId={branch.id} current="hours" />
      <AdminFormMessages extra={['Hours', 'AdminHours']}>
        {/* The render time seeds the preview, so the server and browser show the same moment. */}
        <HoursEditor branchId={branch.id} hours={hours} now={new Date().toISOString()} />
      </AdminFormMessages>
    </div>
  );
}

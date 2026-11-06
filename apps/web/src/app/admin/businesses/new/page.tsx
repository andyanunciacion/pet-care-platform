import type { Metadata } from 'next';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { BusinessForm } from '@/components/admin/business-form';
import { AdminFormMessages } from '@/components/admin/form-messages';
import { requireAdmin } from '@/lib/admin-session';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('AdminBusiness');
  return { title: t('newTitle') };
}

export default async function NewBusinessPage() {
  await requireAdmin();
  const t = await getTranslations('AdminBusiness');

  return (
    <div className="flex flex-col gap-6">
      <Link href="/admin/businesses" className="text-sm text-muted-foreground hover:underline">
        {t('backToListings')}
      </Link>
      <h1 className="text-2xl font-bold">{t('newTitle')}</h1>
      <AdminFormMessages>
        <BusinessForm />
      </AdminFormMessages>
    </div>
  );
}

import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { requireAdmin } from '@/lib/admin-session';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Admin');
  return { title: t('title') };
}

export default async function AdminPage() {
  // Every admin page starts with this, even though the layout calls it too.
  await requireAdmin();
  const t = await getTranslations('Admin');
  return (
    <>
      <h1 className="text-2xl font-bold">{t('title')}</h1>
      <p className="mt-2 text-muted-foreground">{t('comingSoon')}</p>
    </>
  );
}

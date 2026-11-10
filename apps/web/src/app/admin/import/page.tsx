import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { CsvImport } from '@/components/admin/csv-import';
import { AdminFormMessages } from '@/components/admin/form-messages';
import { requireAdmin } from '@/lib/admin-session';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('AdminImport');
  return { title: t('title') };
}

/** The template's columns match the import format (AI_DOCS/csv-import.md); an API test checks it. */
const TEMPLATE_HREF = '/templates/paw-listings-template.csv';

export default async function ImportPage() {
  await requireAdmin();
  const t = await getTranslations('AdminImport');

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold">{t('title')}</h1>
        <p className="text-muted-foreground">{t('subtitle')}</p>
      </div>
      <div className="flex flex-col gap-1 text-sm">
        <a href={TEMPLATE_HREF} download className="w-fit font-medium text-primary hover:underline">
          {t('template')}
        </a>
        <p className="max-w-3xl text-muted-foreground">{t('templateHint')}</p>
      </div>
      <AdminFormMessages extra={['AdminImport']}>
        <CsvImport />
      </AdminFormMessages>
    </div>
  );
}

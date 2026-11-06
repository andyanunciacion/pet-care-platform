import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { cn } from '@/lib/utils';

const TABS = ['details', 'hours'] as const;
type Tab = (typeof TABS)[number];

/** "Details | Hours" links between a branch's admin pages. P1-2d adds Services and Photos. */
export async function BranchTabs({
  businessId,
  branchId,
  current,
}: {
  businessId: string;
  branchId: string;
  current: Tab;
}) {
  const t = await getTranslations('AdminHours');
  const base = `/admin/businesses/${businessId}/branches/${branchId}`;
  const tabs = {
    details: { href: base, label: t('tabDetails') },
    hours: { href: `${base}/hours`, label: t('tabHours') },
  } satisfies Record<Tab, { href: string; label: string }>;

  return (
    <nav aria-label={t('tabsLabel')} className="flex gap-1 border-b">
      {TABS.map((tab) => (
        <Link
          key={tab}
          href={tabs[tab].href}
          aria-current={tab === current ? 'page' : undefined}
          className={cn(
            '-mb-px border-b-2 px-3 py-2 text-sm font-medium',
            tab === current
              ? 'border-primary text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground',
          )}
        >
          {tabs[tab].label}
        </Link>
      ))}
    </nav>
  );
}

import { CircleCheck, CircleX, LoaderCircle, TriangleAlert } from 'lucide-react';
import { connection } from 'next/server';
import { getTranslations } from 'next-intl/server';
import { apiClient } from '@/lib/api';
import { getApiStatus, type ApiStatus as Status } from '@/lib/api-status';
import { cn } from '@/lib/utils';

// Status is always icon + text + color, never color alone (DESIGN.md UX4, §10).
const presentation = {
  ok: { Icon: CircleCheck, className: 'text-status-open' },
  degraded: { Icon: TriangleAlert, className: 'text-status-closing' },
  down: { Icon: CircleX, className: 'text-status-closed' },
} as const satisfies Record<Status, { Icon: typeof CircleCheck; className: string }>;

/** Live API and database status, fetched through the typed client on every request. */
export async function ApiStatus() {
  // Render per request: without this, Next.js could prerender the status once at build time.
  await connection();
  const status = await getApiStatus(apiClient());
  const t = await getTranslations('ApiStatus');
  const { Icon, className } = presentation[status];

  return (
    <p role="status" className={cn('flex items-center gap-2 font-medium', className)}>
      <Icon aria-hidden className="size-5 shrink-0" />
      {t(status)}
    </p>
  );
}

/** Shown while ApiStatus waits for the API. */
export async function ApiStatusPending() {
  const t = await getTranslations('ApiStatus');
  return (
    <p className="flex items-center gap-2 text-muted-foreground">
      <LoaderCircle
        aria-hidden
        className="size-5 shrink-0 animate-spin motion-reduce:animate-none"
      />
      {t('checking')}
    </p>
  );
}

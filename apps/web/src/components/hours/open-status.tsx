// How owners see a branch's status (DESIGN UX4, UX5, UX17). Shared by the admin hours
// preview and (P1-4) the public page; works in Server and Client Components alike.
import { addDays, freshness, isoWeekday, type LocalMoment, type OpenStatus } from '@paw/domain';
import { CircleAlert, CircleCheck, CircleHelp, CircleX, Clock } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import type { HoursConfirmedBy } from '@/lib/admin-types';
import { wallTimeLabel, weekdayLabel } from '@/lib/hours-format';
import { cn } from '@/lib/utils';

function useMomentLabel() {
  const t = useTranslations('Hours');
  const locale = useLocale();

  return (moment: LocalMoment, kind: 'opens' | 'closes'): string => {
    // Closing at "00:00" a day later is midnight at the end of the day before ("closes midnight").
    const midnight = kind === 'closes' && moment.time === '00:00' && moment.daysFromToday >= 1;
    const days = midnight ? moment.daysFromToday - 1 : moment.daysFromToday;
    const time = midnight ? t('midnight') : wallTimeLabel(moment.time, locale);
    const weekday = weekdayLabel(
      isoWeekday(midnight ? addDays(moment.date, -1) : moment.date),
      locale,
      'long',
    );
    if (kind === 'closes') {
      return days === 0 ? t('closes', { time }) : t('closesTomorrow', { time });
    }
    if (days === 0) return t('opens', { time });
    if (days === 1) return t('opensTomorrow', { time });
    return t('opensOn', { weekday, time });
  };
}

const STYLE = {
  open: { Icon: CircleCheck, color: 'text-status-open' },
  closing_soon: { Icon: Clock, color: 'text-status-closing' },
  open_24h: { Icon: CircleCheck, color: 'text-status-open' },
  closed: { Icon: CircleX, color: 'text-status-closed' },
  closed_today: { Icon: CircleX, color: 'text-status-closed' },
  unknown: { Icon: CircleHelp, color: 'text-status-unknown' },
} as const satisfies Record<OpenStatus['state'], unknown>;

/** "Open · closes 6 PM", "Closed today · opens 8 AM tomorrow", "Hours unknown — call ahead". */
export function OpenStatusText({ status, className }: { status: OpenStatus; className?: string }) {
  const t = useTranslations('Hours');
  const momentLabel = useMomentLabel();
  const opens = (moment: LocalMoment | null) =>
    moment === null ? null : momentLabel(moment, 'opens');

  const [label, detail, note] = ((): [string, string | null, string | null] => {
    switch (status.state) {
      case 'open':
        return [t('open'), momentLabel(status.closesAt, 'closes'), null];
      case 'closing_soon':
        return [t('closingSoon'), momentLabel(status.closesAt, 'closes'), null];
      case 'open_24h':
        return [t('open24h'), null, null];
      case 'closed':
        return [t('closed'), opens(status.opensAt), null];
      case 'closed_today':
        return [t('closedToday'), opens(status.opensAt), status.note];
      case 'unknown':
        return [t('unknown'), null, null];
    }
  })();
  const { Icon, color } = STYLE[status.state];

  return (
    <div className={cn('flex flex-col gap-0.5', className)}>
      <p className="flex items-center gap-1.5">
        <Icon aria-hidden className={cn('size-5 shrink-0', color)} />
        <span className={cn('font-semibold', color)}>{label}</span>
        {detail !== null && <span>· {detail}</span>}
      </p>
      {note !== null && <p className="pl-6.5 text-sm text-muted-foreground">{note}</p>}
    </div>
  );
}

/** "Hours confirmed 5 days ago by PAW" (UX5); amber with a warning when aging or stale. */
export function HoursFreshness({
  confirmedAt,
  confirmedBy,
  now,
}: {
  confirmedAt: string | null;
  confirmedBy: HoursConfirmedBy | null;
  now: Date;
}) {
  const t = useTranslations('Hours');
  const { level, daysAgo } = freshness(confirmedAt === null ? null : new Date(confirmedAt), now);
  const fresh = level === 'fresh';

  return (
    <p
      className={cn(
        'flex items-start gap-1.5 text-sm',
        fresh ? 'text-muted-foreground' : 'text-stale',
      )}
    >
      {!fresh && <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />}
      <span>
        {daysAgo === null || confirmedBy === null
          ? t('notConfirmed')
          : t('confirmed', { days: daysAgo, by: confirmedBy })}
        {level === 'aging' && ` ${t('aging')}`}
      </span>
    </p>
  );
}

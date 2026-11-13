// How owners see a branch's status (DESIGN UX4, UX5, UX17). Shared by the admin hours
// preview and (P1-4) the public page; works in Server and Client Components alike.
import {
  addDays,
  freshness,
  isoWeekday,
  TIME_ZONE,
  type LocalMoment,
  type OpenStatus,
} from '@paw/domain';
import { CircleAlert, CircleCheck, CircleHelp, CircleX, Clock } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import type { HoursConfirmedBy } from '@/lib/admin-types';
import type { ContactReach } from '@/lib/contact-links';
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

/** What to do when hours are unknown, by how the branch can be reached (DESIGN UX17). */
const UNKNOWN_ADVICE = {
  call: 'unknownAdvice.call',
  message: 'unknownAdvice.message',
  visit: 'unknownAdvice.visit',
} as const satisfies Record<ContactReach, string>;

/**
 * "Open · closes 6 PM", "Closed today · opens 8 AM tomorrow", or "Hours unknown" with what to
 * do on the next line ("Call before you go."), in body text: the advice is the useful part,
 * so it isn't greyed out with the label. `reach` picks the advice; the admin preview leaves
 * it at "call".
 */
export function OpenStatusText({
  status,
  reach = 'call',
  className,
}: {
  status: OpenStatus;
  reach?: ContactReach;
  className?: string;
}) {
  const t = useTranslations('Hours');
  const momentLabel = useMomentLabel();
  const opens = (moment: LocalMoment | null) =>
    moment === null ? null : momentLabel(moment, 'opens');

  const advice = status.state === 'unknown' ? t(UNKNOWN_ADVICE[reach]) : null;
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
      {advice !== null && <p className="pl-6.5 text-base">{advice}</p>}
    </div>
  );
}

/**
 * "Hours confirmed 5 days ago by PAW" (UX5); amber with a warning when aging or stale.
 * Without `now` (a cached page before hydration) it gives the date instead ("confirmed
 * Nov 6, 2026"), which stays true however old the page is, and holds back the amber
 * warning it can't judge yet, except for hours never confirmed.
 */
export function HoursFreshness({
  confirmedAt,
  confirmedBy,
  now,
}: {
  confirmedAt: string | null;
  confirmedBy: HoursConfirmedBy | null;
  now: Date | null;
}) {
  const t = useTranslations('Hours');
  const locale = useLocale();
  const confirmed = confirmedAt === null ? null : new Date(confirmedAt);

  if (now === null && confirmed !== null && confirmedBy !== null) {
    const date = new Intl.DateTimeFormat(locale, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      timeZone: TIME_ZONE,
    }).format(confirmed);
    return (
      <p className="text-sm text-muted-foreground">{t('confirmedOn', { date, by: confirmedBy })}</p>
    );
  }

  // Without `now` we only get here for hours never confirmed, which is stale at any time.
  const { level, daysAgo } =
    now === null ? { level: 'stale' as const, daysAgo: null } : freshness(confirmed, now);
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

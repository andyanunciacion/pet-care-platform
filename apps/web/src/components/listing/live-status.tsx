'use client';

import {
  hasHoursData,
  isoWeekday,
  openStatus,
  toManila,
  type BranchHours,
  type OpenStatus,
} from '@paw/domain';
import { Clock, HeartPulse } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { HoursFreshness, OpenStatusText } from '@/components/hours/open-status';
import { useNow } from '@/components/hours/use-now';
import type { HoursConfirmedBy } from '@/lib/admin-types';
import type { ContactReach } from '@/lib/contact-links';
import { intervalLabel, intervalsByDay, weekdayLabel } from '@/lib/hours-format';
import { cn } from '@/lib/utils';

// The clinic page's time-dependent lines (DESIGN UX4, UX5). The page is cached and can be
// days old when served (ARCHITECTURE D41), so before hydration these render only what stays
// true at any time; the verdict ("Open · closes 5 PM") appears once the browser knows the time.

/**
 * A named day's hours, "Thursday: 8 AM – 12 PM, 1 PM – 5 PM": the cached page's stand-in
 * for the open status. Naming the weekday keeps it true even when the page is old.
 */
function DayHours({
  hours,
  date,
  reach,
  className,
}: {
  hours: BranchHours;
  date: string;
  reach: ContactReach;
  className?: string;
}) {
  const t = useTranslations('Hours');
  const locale = useLocale();
  const exception = hours.exceptions.find((candidate) => candidate.date === date);
  if (exception === undefined && hours.is24h) {
    return <OpenStatusText status={{ state: 'open_24h' }} className={className} />;
  }
  if (exception === undefined && !hasHoursData({ ...hours, exceptions: [] })) {
    return <OpenStatusText status={{ state: 'unknown' }} reach={reach} className={className} />;
  }
  const intervals =
    exception === undefined
      ? (intervalsByDay(hours.weekly).get(isoWeekday(date)) ?? [])
      : exception.intervals;
  const text =
    intervals.length === 0
      ? t('closed')
      : intervals.map((interval) => intervalLabel(interval, locale)).join(', ');
  return (
    <p className={cn('flex items-center gap-1.5', className)}>
      <Clock aria-hidden className="size-5 shrink-0 text-muted-foreground" />
      <span>
        {t('dayHours', { weekday: weekdayLabel(isoWeekday(date), locale, 'long'), hours: text })}
      </span>
    </p>
  );
}

/**
 * "Open · closes 6 PM", "Closed · opens 8 AM tomorrow", "Hours unknown"; before
 * hydration, the hours of the day the page was rendered, by name. `reach` (how the branch
 * can be contacted) picks the "Hours unknown" advice, so it never says "call" without a phone.
 */
export function LiveStatus({
  hours,
  renderedAt,
  reach,
  className,
}: {
  hours: BranchHours;
  renderedAt: string;
  reach: ContactReach;
  className?: string;
}) {
  const now = useNow();
  if (now === null) {
    return (
      <DayHours
        hours={hours}
        date={toManila(new Date(renderedAt)).date}
        reach={reach}
        className={className}
      />
    );
  }
  return <OpenStatusText status={openStatus(hours, now)} reach={reach} className={className} />;
}

/** "Hours confirmed 5 days ago by PAW" (the date until hydrated), amber once it's aging. */
export function LiveFreshness({
  confirmedAt,
  confirmedBy,
}: {
  confirmedAt: string | null;
  confirmedBy: HoursConfirmedBy | null;
}) {
  return <HoursFreshness confirmedAt={confirmedAt} confirmedBy={confirmedBy} now={useNow()} />;
}

/** The emergencies line's wording, one per situation (strings from the Listing messages). */
export interface EmergencyLabels {
  /** Before hydration: true at any time. */
  anytime: string;
  open: string;
  closed: string;
  unknown: string;
}

const EMERGENCY_LABEL = {
  open: 'open',
  closing_soon: 'open',
  open_24h: 'open',
  closed: 'closed',
  closed_today: 'closed',
  unknown: 'unknown',
} as const satisfies Record<OpenStatus['state'], keyof EmergencyLabels>;

/**
 * A branch that takes emergencies can be called about one even when it's closed (DESIGN
 * UX19), so the line follows the status: "Takes emergencies" while open, "Closed now · call
 * for emergencies" otherwise, in bold then: when the branch is closed, calling is the thing to
 * do. Plain text color: emergency red is for the Emergency view.
 */
export function EmergencyLine({ hours, labels }: { hours: BranchHours; labels: EmergencyLabels }) {
  const now = useNow();
  const situation = now === null ? 'anytime' : EMERGENCY_LABEL[openStatus(hours, now).state];
  return (
    <p
      className={cn(
        'flex items-center gap-1.5',
        situation === 'closed' || situation === 'unknown' ? 'font-bold' : 'font-medium',
      )}
    >
      <HeartPulse aria-hidden className="size-5 shrink-0" />
      {labels[situation]}
    </p>
  );
}

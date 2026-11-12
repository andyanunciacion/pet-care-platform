'use client';

import { hasHoursData, isoWeekday, toManila, type BranchHours } from '@paw/domain';
import { useLocale, useTranslations } from 'next-intl';
import { useExceptionSummary } from '@/components/hours/exception-summary';
import { useNow } from '@/components/hours/use-now';
import {
  dateLabel,
  intervalLabel,
  intervalsByDay,
  isOvernight,
  wallTimeLabel,
  weekdayLabel,
} from '@/lib/hours-format';
import { cn } from '@/lib/utils';

/** How many upcoming exceptions the page lists. */
const MAX_EXCEPTIONS = 5;

/**
 * The week with today highlighted, overnight hours spelled out, and the coming exceptions
 * (DESIGN UX8). Which day is today is only known once hydrated (the page is cached, D41):
 * until then no row is marked, and exceptions are filtered by the day the page was rendered.
 */
export function HoursTable({ hours, renderedAt }: { hours: BranchHours; renderedAt: string }) {
  const t = useTranslations('Hours');
  const locale = useLocale();
  const summary = useExceptionSummary();
  const now = useNow();

  const today = toManila(now ?? new Date(renderedAt)).date;
  const todayWeekday = now === null ? null : isoWeekday(today);
  const currentYear = Number(today.slice(0, 4));
  const upcoming = hours.exceptions
    .filter((exception) => exception.date >= today)
    .slice(0, MAX_EXCEPTIONS);

  return (
    <div className="flex flex-col gap-5">
      {hours.is24h ? (
        <p className="font-medium">{t('open24h')}</p>
      ) : !hasHoursData({ ...hours, exceptions: [] }) ? (
        <p>{t('notShared')}</p>
      ) : (
        <table className="w-full">
          <tbody>
            {[...intervalsByDay(hours.weekly)].map(([day, intervals]) => {
              const isToday = day === todayWeekday;
              return (
                <tr
                  key={day}
                  aria-current={isToday ? 'date' : undefined}
                  className={cn(isToday && 'bg-accent font-semibold')}
                >
                  <th
                    scope="row"
                    className="rounded-l-md py-2 pr-4 pl-3 text-left align-top font-[inherit]"
                  >
                    {weekdayLabel(day, locale, 'long')}
                    {isToday && <span className="block text-sm font-normal">{t('today')}</span>}
                  </th>
                  <td className="rounded-r-md py-2 pr-3 align-top">
                    {intervals.length === 0
                      ? t('closed')
                      : intervals.map((interval) => (
                          <div key={interval.opensAt}>
                            {isOvernight(interval)
                              ? t('intervalNextDay', {
                                  opens: wallTimeLabel(interval.opensAt, locale),
                                  closes: wallTimeLabel(interval.closesAt, locale),
                                })
                              : intervalLabel(interval, locale)}
                          </div>
                        ))}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {upcoming.length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className="font-semibold">{t('exceptionsTitle')}</h3>
          <ul className="flex flex-col gap-1">
            {upcoming.map((exception) => (
              <li key={exception.date}>
                <span className="font-medium">
                  {dateLabel(exception.date, locale, currentYear)}
                </span>
                {': '}
                {summary(exception)}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

'use client';

import {
  formatTime,
  hasHoursData,
  isoWeekday,
  openStatus,
  toManila,
  type BranchHours as DomainHours,
} from '@paw/domain';
import { useLocale, useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';
import { confirmHoursAction } from '@/app/admin/actions';
import { HoursFreshness, OpenStatusText } from '@/components/hours/open-status';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { BranchHours } from '@/lib/admin-types';
import { idleForm, type FormState } from '@/lib/form-errors';
import { dateLabel, intervalLabel, intervalsByDay, weekdayLabel } from '@/lib/hours-format';
import { cn } from '@/lib/utils';
import { useExceptionSummary } from './hours-exceptions';

/** An instant → the value of a `datetime-local` input, in Manila time ("2026-11-06T14:30"). */
function toInputValue(instant: Date): string {
  const { date, minutes } = toManila(instant);
  return `${date}T${formatTime(minutes)}`;
}

/** A `datetime-local` value read as Manila time (UTC+8 all year: no daylight saving, D29). */
function fromInputValue(value: string): Date | null {
  const instant = new Date(`${value}:00+08:00`);
  return Number.isNaN(instant.getTime()) ? null : instant;
}

interface Props {
  branchId: string;
  /** The hours to preview: the editor's current (maybe unsaved) week plus saved exceptions. */
  hours: DomainHours;
  /** What's saved: confirmation and "can it be confirmed". */
  saved: BranchHours;
  dirty: boolean;
  /** When the page was rendered (ISO), so the server and browser render the same preview. */
  now: string;
}

/** How owners will see the branch at a chosen moment (UX13 "live preview"). */
export function HoursPreview({ branchId, hours, saved, dirty, now }: Props) {
  const t = useTranslations('AdminHours');
  const tHours = useTranslations('Hours');
  const locale = useLocale();
  const summary = useExceptionSummary();
  const renderedAt = new Date(now);
  const [at, setAt] = useState(() => toInputValue(renderedAt));
  const [confirmState, setConfirmState] = useState<FormState>(idleForm);
  const [pending, startTransition] = useTransition();

  const instant = fromInputValue(at) ?? renderedAt;
  const status = openStatus(hours, instant);
  const previewDay = isoWeekday(toManila(instant).date);
  const byDay = intervalsByDay(hours.weekly);
  const currentYear = Number(saved.today.slice(0, 4));

  const savedHasHours = hasHoursData({ ...saved, exceptions: [] });
  const confirmBlocked = dirty
    ? t('confirmSaveFirst')
    : savedHasHours
      ? null
      : t('confirmNeedsHours');

  return (
    <aside
      aria-labelledby="preview-heading"
      className="flex flex-col gap-5 self-start rounded-lg border p-4 lg:sticky lg:top-4"
    >
      <div className="flex flex-col gap-1">
        <h2 id="preview-heading" className="text-lg font-semibold">
          {t('previewTitle')}
        </h2>
        <p className="text-sm text-muted-foreground">{t('previewHint')}</p>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="preview-at">{t('previewAt')}</Label>
        <div className="flex gap-2">
          <Input
            id="preview-at"
            type="datetime-local"
            value={at}
            onChange={(event) => {
              setAt(event.target.value);
            }}
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setAt(toInputValue(new Date()));
            }}
          >
            {t('previewNow')}
          </Button>
        </div>
      </div>

      {/* aria-live: screen readers hear the new status as hours or the moment change. */}
      <div aria-live="polite" className="rounded-md bg-muted/50 p-3">
        <OpenStatusText status={status} />
      </div>

      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-medium">{tHours('weekTitle')}</h3>
        {hours.is24h ? (
          <p className="text-sm">{tHours('open24h')}</p>
        ) : !hasHoursData(hours) ? (
          <p className="text-sm text-status-unknown">{tHours('unknown')}</p>
        ) : (
          <table className="text-sm">
            <tbody>
              {[...byDay].map(([day, intervals]) => (
                <tr key={day} className={cn(day === previewDay && 'font-semibold')}>
                  <th scope="row" className="py-0.5 pr-4 text-left align-top font-[inherit]">
                    {weekdayLabel(day, locale, 'short')}
                  </th>
                  <td className="py-0.5">
                    {intervals.length === 0
                      ? tHours('closed')
                      : intervals.map((interval) => (
                          <div key={interval.opensAt}>{intervalLabel(interval, locale)}</div>
                        ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {saved.exceptions.length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-medium">{tHours('exceptionsTitle')}</h3>
          <ul className="flex flex-col gap-1 text-sm">
            {saved.exceptions.slice(0, 5).map((exception) => (
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

      <div className="flex flex-col gap-2 border-t pt-4">
        <HoursFreshness
          confirmedAt={saved.hoursConfirmedAt}
          confirmedBy={saved.hoursConfirmedBy}
          now={renderedAt}
        />
        <p className="text-sm text-muted-foreground">{confirmBlocked ?? t('confirmHint')}</p>
        <div>
          <Button
            type="button"
            variant="secondary"
            disabled={pending || confirmBlocked !== null}
            onClick={() => {
              startTransition(async () => {
                setConfirmState(await confirmHoursAction(branchId));
              });
            }}
          >
            {t('confirmHours')}
          </Button>
        </div>
        {confirmState.status === 'error' && (
          <p role="alert" className="text-sm text-destructive">
            {confirmState.formError}
          </p>
        )}
      </div>
    </aside>
  );
}

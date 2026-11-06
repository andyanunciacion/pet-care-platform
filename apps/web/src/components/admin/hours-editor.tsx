'use client';

// The admin hours editor (DESIGN UX13): weekly grid, exceptions, "Closed today", and a live
// preview of how owners see the branch. The weekly grid is one form (saved as a whole);
// exceptions and "Closed today" save one date at a time (ARCHITECTURE D35).

import {
  BUSINESS_TYPE_RULES,
  MAX_INTERVALS_PER_DAY,
  weeklyHoursIssues,
  type HoursIssue,
  type WeeklyInterval,
} from '@paw/domain';
import { Copy } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useState, useTransition, type SubmitEvent } from 'react';
import { updateHoursAction } from '@/app/admin/actions';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import type { BranchHours } from '@/lib/admin-types';
import { errorAt, idleForm, type FormState } from '@/lib/form-errors';
import { intervalsByDay, isCompleteTime, weekdayLabel } from '@/lib/hours-format';
import { ClosedToday } from './closed-today';
import { FormStatus } from './form-field';
import { HoursExceptions } from './hours-exceptions';
import { HoursPreview } from './hours-preview';
import { IntervalRows, newIntervalRow, type IntervalRow } from './interval-rows';

const DAYS = [1, 2, 3, 4, 5, 6, 7] as const;
const WEEKDAYS = [1, 2, 3, 4, 5] as const;

/** One list of rows per ISO weekday (index 0 = Monday). */
type Week = IntervalRow[][];

/** Keys must match on the server and in the browser, so rows from the page use their position. */
function initialWeek(weekly: BranchHours['weekly']): Week {
  const byDay = intervalsByDay(weekly);
  return DAYS.map((day) =>
    (byDay.get(day) ?? []).map((interval, i) => ({
      key: `${String(day)}-${String(i)}`,
      ...interval,
    })),
  );
}

/** The week as the API takes it, plus each interval's row key (to place errors). */
function flatten(week: Week): { intervals: WeeklyInterval[]; keys: string[] } {
  const rows = week.flatMap((rows, i) => rows.map((row) => ({ dayOfWeek: i + 1, row })));
  return {
    intervals: rows.map(({ dayOfWeek, row }) => ({
      dayOfWeek,
      opensAt: row.opensAt,
      closesAt: row.closesAt,
    })),
    keys: rows.map(({ row }) => row.key),
  };
}

/** Comparable form of a schedule, to tell whether the editor has unsaved changes. */
function fingerprint(is24h: boolean, intervals: readonly WeeklyInterval[]): string {
  const sorted = intervals.map((i) => `${String(i.dayOfWeek)} ${i.opensAt} ${i.closesAt}`).sort();
  return JSON.stringify([is24h, sorted]);
}

/** Intervals the preview can use: complete and not empty (the rest are still being typed). */
const usable = (interval: WeeklyInterval) =>
  isCompleteTime(interval.opensAt) &&
  isCompleteTime(interval.closesAt) &&
  interval.opensAt !== interval.closesAt;

interface Props {
  branchId: string;
  hours: BranchHours;
  /** When the page was rendered: the preview starts here (same value on server and browser). */
  now: string;
}

export function HoursEditor({ branchId, hours, now }: Props) {
  const t = useTranslations('AdminHours');
  const tForms = useTranslations('AdminForms');
  const locale = useLocale();
  const [state, setState] = useState<FormState>(idleForm);
  const [pending, startTransition] = useTransition();

  const [is24h, setIs24h] = useState(hours.is24h);
  const [week, setWeek] = useState(() => initialWeek(hours.weekly));
  const [submitted, setSubmitted] = useState(false);
  const [sentKeys, setSentKeys] = useState<string[]>([]);

  const showIs24h = BUSINESS_TYPE_RULES[hours.businessType].emergencyFlags;
  const { intervals, keys } = flatten(week);
  const issues = weeklyHoursIssues(intervals);
  const dirty = fingerprint(is24h, intervals) !== fingerprint(hours.is24h, hours.weekly);

  const issueMessage = ({ code }: HoursIssue) =>
    code === 'too_many'
      ? t('issues.too_many', { max: MAX_INTERVALS_PER_DAY })
      : t(`issues.${code}`);

  /** The error to show under a row: the editor's own checks first, then the API's. */
  const rowError = (key: string): string | undefined => {
    const issue = issues.find(
      // Half-typed times are flagged only after a save attempt; overlaps right away.
      (i) => keys[i.index] === key && (submitted || i.code !== 'invalid_time'),
    );
    if (issue !== undefined) return issueMessage(issue);
    const sent = sentKeys.indexOf(key);
    return sent === -1 ? undefined : errorAt(state, `weekly.${String(sent)}`);
  };

  const setDay = (dayIndex: number, rows: IntervalRow[]) => {
    setWeek(week.map((day, i) => (i === dayIndex ? rows : day)));
  };

  const copyToWeekdays = (dayIndex: number) => {
    const source = week[dayIndex] ?? [];
    setWeek(
      week.map((day, i) =>
        i !== dayIndex && (WEEKDAYS as readonly number[]).includes(i + 1)
          ? source.map((row) => newIntervalRow(row.opensAt, row.closesAt))
          : day,
      ),
    );
  };

  function onSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);
    if (issues.length > 0) {
      setState({ status: 'error', formError: tForms('fixErrors'), fieldErrors: {} });
      return;
    }
    setSentKeys(keys);
    startTransition(async () => {
      setState(await updateHoursAction(branchId, { is24h: showIs24h && is24h, weekly: intervals }));
    });
  }

  const noHours = !is24h && intervals.length === 0;

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="flex min-w-0 flex-col gap-10">
        <ClosedToday branchId={branchId} today={hours.today} exceptions={hours.exceptions} />

        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <h2 className="text-lg font-semibold">{t('weeklyTitle')}</h2>
            <p className="text-sm text-muted-foreground">{t('weeklyHint')}</p>
          </div>

          {showIs24h && (
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="is24h"
                  checked={is24h}
                  onCheckedChange={(checked) => {
                    setIs24h(checked === true);
                  }}
                />
                <Label htmlFor="is24h">{t('is24h')}</Label>
              </div>
              {is24h && <p className="text-sm text-muted-foreground">{t('is24hHint')}</p>}
              {errorAt(state, 'is24h') !== undefined && (
                <p className="text-sm text-destructive">{errorAt(state, 'is24h')}</p>
              )}
            </div>
          )}

          <fieldset
            disabled={is24h}
            className="flex flex-col divide-y rounded-lg border disabled:opacity-60"
          >
            <legend className="sr-only">{t('weeklyTitle')}</legend>
            {DAYS.map((day, dayIndex) => {
              const rows = week[dayIndex] ?? [];
              const dayName = weekdayLabel(day, locale, 'long');
              const open = rows.length > 0;
              return (
                <div key={day} className="flex flex-wrap items-start gap-x-6 gap-y-2 p-3">
                  <div className="flex w-36 items-center gap-2 pt-2">
                    <Checkbox
                      id={`day-${String(day)}`}
                      checked={open}
                      aria-label={t('dayOpen', { day: dayName })}
                      onCheckedChange={(checked) => {
                        setDay(
                          dayIndex,
                          checked === true ? [newIntervalRow('08:00', '17:00')] : [],
                        );
                      }}
                    />
                    <Label htmlFor={`day-${String(day)}`} className="font-medium">
                      {dayName}
                    </Label>
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col gap-2">
                    {open ? (
                      <IntervalRows
                        rows={rows}
                        onChange={(next) => {
                          setDay(dayIndex, next);
                        }}
                        rowLabel={(i) => t('intervalLabel', { day: dayName, number: i + 1 })}
                        errorFor={(i) => rowError(rows[i]?.key ?? '')}
                      />
                    ) : (
                      <p className="pt-2 text-sm text-muted-foreground">{t('dayClosed')}</p>
                    )}
                  </div>
                  {open && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="mt-1"
                      onClick={() => {
                        copyToWeekdays(dayIndex);
                      }}
                    >
                      <Copy aria-hidden />
                      {t('copyToWeekdays')}
                    </Button>
                  )}
                </div>
              );
            })}
          </fieldset>

          {noHours && <p className="text-sm text-stale">{t('noHoursWarning')}</p>}

          <div className="flex flex-wrap items-center gap-4">
            <Button type="submit" disabled={pending}>
              {pending ? tForms('saving') : t('saveHours')}
            </Button>
            <FormStatus
              formError={state.formError}
              hasFieldErrors={Object.keys(state.fieldErrors).length > 0}
              saved={state.status === 'saved' && !pending && !dirty}
              fixErrorsLabel={tForms('fixErrors')}
              savedLabel={tForms('saved')}
            />
            {dirty && !pending && <p className="text-sm text-muted-foreground">{t('unsaved')}</p>}
          </div>
        </form>

        <HoursExceptions branchId={branchId} today={hours.today} exceptions={hours.exceptions} />
      </div>

      <HoursPreview
        branchId={branchId}
        hours={{ is24h, weekly: intervals.filter(usable), exceptions: hours.exceptions }}
        saved={hours}
        dirty={dirty}
        now={now}
      />
    </div>
  );
}

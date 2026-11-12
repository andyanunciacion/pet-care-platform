'use client';

import { addDays, dayIntervalsIssues, MAX_INTERVALS_PER_DAY } from '@paw/domain';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useState, useTransition, type SubmitEvent } from 'react';
import { deleteHoursExceptionAction, setHoursExceptionAction } from '@/app/admin/actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { BranchHours } from '@/lib/admin-types';
import { errorAt, idleForm, type FormState } from '@/lib/form-errors';
import { dateLabel } from '@/lib/hours-format';
import { describedBy, FormField, FormStatus } from './form-field';
import { useExceptionSummary } from '@/components/hours/exception-summary';
import { IntervalRows, newIntervalRow, type IntervalRow } from './interval-rows';

type Exception = BranchHours['exceptions'][number];

interface Props {
  branchId: string;
  today: string;
  exceptions: BranchHours['exceptions'];
}

/** Upcoming dates with different hours (holidays, special days), each saved on its own. */
export function HoursExceptions({ branchId, today, exceptions }: Props) {
  const t = useTranslations('AdminHours');
  const locale = useLocale();
  const summary = useExceptionSummary();
  // null: nothing open; 'new': the add form; a date: that exception's edit form.
  const [editing, setEditing] = useState<string | null>(null);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const currentYear = Number(today.slice(0, 4));

  const close = () => {
    setEditing(null);
  };

  return (
    <section aria-labelledby="exceptions-heading" className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 id="exceptions-heading" className="text-lg font-semibold">
          {t('exceptionsTitle')}
        </h2>
        <p className="text-sm text-muted-foreground">{t('exceptionsHint')}</p>
      </div>

      {exceptions.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('noExceptions')}</p>
      ) : (
        <ul className="flex flex-col divide-y rounded-lg border">
          {exceptions.map((exception) =>
            editing === exception.date ? (
              <li key={exception.date} className="p-3">
                <ExceptionForm
                  branchId={branchId}
                  today={today}
                  exception={exception}
                  existingDates={[]}
                  onDone={close}
                />
              </li>
            ) : (
              <li key={exception.date} className="flex flex-wrap items-center gap-x-4 gap-y-1 p-3">
                <span className="w-36 font-medium">
                  {dateLabel(exception.date, locale, currentYear)}
                </span>
                <span className="min-w-0 flex-1 text-sm">{summary(exception)}</span>
                <div className="flex gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setEditing(exception.date);
                    }}
                  >
                    <Pencil aria-hidden />
                    {t('edit')}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={pending}
                    onClick={() => {
                      setRemoveError(null);
                      startTransition(async () => {
                        const result = await deleteHoursExceptionAction(branchId, exception.date);
                        if (result.status === 'error') setRemoveError(t('removeFailed'));
                      });
                    }}
                  >
                    <Trash2 aria-hidden />
                    {t('remove')}
                  </Button>
                </div>
              </li>
            ),
          )}
        </ul>
      )}
      {removeError !== null && (
        <p role="alert" className="text-sm text-destructive">
          {removeError}
        </p>
      )}

      {editing === 'new' ? (
        <div className="rounded-lg border p-3">
          <ExceptionForm
            branchId={branchId}
            today={today}
            existingDates={exceptions.map((exception) => exception.date)}
            onDone={close}
          />
        </div>
      ) : (
        <div>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setEditing('new');
            }}
          >
            <Plus aria-hidden />
            {t('addException')}
          </Button>
        </div>
      )}
    </section>
  );
}

interface FormProps {
  branchId: string;
  today: string;
  /** The exception being edited; omit to add one. */
  exception?: Exception;
  /** Dates that already have an exception (adding one there replaces it). */
  existingDates: string[];
  onDone: () => void;
}

function ExceptionForm({ branchId, today, exception, existingDates, onDone }: FormProps) {
  const t = useTranslations('AdminHours');
  const tForms = useTranslations('AdminForms');
  const [state, setState] = useState<FormState>(idleForm);
  const [pending, startTransition] = useTransition();
  const [submitted, setSubmitted] = useState(false);

  const [date, setDate] = useState(exception?.date ?? '');
  const [isClosed, setIsClosed] = useState(exception?.isClosed ?? true);
  const [rows, setRows] = useState<IntervalRow[]>(() =>
    exception === undefined || exception.isClosed
      ? [newIntervalRow()]
      : exception.intervals.map((interval) => newIntervalRow(interval.opensAt, interval.closesAt)),
  );
  const [note, setNote] = useState(exception?.note ?? '');

  const intervals = isClosed ? [] : rows.map(({ opensAt, closesAt }) => ({ opensAt, closesAt }));
  const issues = dayIntervalsIssues(intervals);
  const idPrefix = exception === undefined ? 'new-exception' : `exception-${exception.date}`;

  const rowError = (index: number): string | undefined => {
    const issue = issues.find((i) => i.index === index && (submitted || i.code !== 'invalid_time'));
    if (issue !== undefined) {
      return issue.code === 'too_many'
        ? t('issues.too_many', { max: MAX_INTERVALS_PER_DAY })
        : t(`issues.${issue.code}`);
    }
    return errorAt(state, `intervals.${String(index)}`);
  };

  function onSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);
    if (date === '') {
      setState({ status: 'error', formError: null, fieldErrors: { date: t('pickDate') } });
      return;
    }
    if (issues.length > 0) {
      setState({ status: 'error', formError: tForms('fixErrors'), fieldErrors: {} });
      return;
    }
    startTransition(async () => {
      const result = await setHoursExceptionAction(branchId, date, {
        isClosed,
        intervals,
        note: note.trim() === '' ? null : note.trim(),
      });
      setState(result);
      if (result.status === 'saved') onDone();
    });
  }

  const dateError = errorAt(state, 'date');
  const dateHint =
    exception === undefined && existingDates.includes(date) ? t('replacesExisting') : undefined;
  const noteError = errorAt(state, 'note');
  // "Closed with hours" / "open without hours": the whole list is to blame.
  const intervalsError = state.fieldErrors.intervals;

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-6">
        <FormField id={`${idPrefix}-date`} label={t('date')} error={dateError} hint={dateHint}>
          <Input
            id={`${idPrefix}-date`}
            type="date"
            className="w-44"
            min={today}
            max={addDays(today, 366)}
            value={date}
            disabled={exception !== undefined}
            aria-invalid={dateError !== undefined}
            aria-describedby={describedBy(`${idPrefix}-date`, dateHint, dateError)}
            onChange={(event) => {
              setDate(event.target.value);
            }}
          />
        </FormField>

        <fieldset className="flex flex-col gap-1.5">
          <legend className="mb-1 text-sm font-medium">{t('exceptionKind')}</legend>
          <div className="flex gap-4 pt-1.5">
            {(
              [
                [true, t('kindClosed')],
                [false, t('kindSpecial')],
              ] as const
            ).map(([closed, label]) => (
              <div key={label} className="flex items-center gap-2">
                <input
                  type="radio"
                  id={`${idPrefix}-${closed ? 'closed' : 'special'}`}
                  name={`${idPrefix}-kind`}
                  className="size-4 accent-primary"
                  checked={isClosed === closed}
                  onChange={() => {
                    setIsClosed(closed);
                  }}
                />
                <Label
                  htmlFor={`${idPrefix}-${closed ? 'closed' : 'special'}`}
                  className="font-normal"
                >
                  {label}
                </Label>
              </div>
            ))}
          </div>
        </fieldset>
      </div>

      {!isClosed && (
        <IntervalRows
          rows={rows}
          onChange={setRows}
          rowLabel={(i) => `${t('kindSpecial')} ${String(i + 1)}`}
          errorFor={rowError}
        />
      )}
      {intervalsError !== undefined && <p className="text-sm text-destructive">{intervalsError}</p>}

      <FormField
        id={`${idPrefix}-note`}
        label={t('note')}
        labelSuffix={tForms('optional')}
        error={noteError}
      >
        <Input
          id={`${idPrefix}-note`}
          className="max-w-md"
          maxLength={200}
          placeholder={t('notePlaceholder')}
          value={note}
          aria-invalid={noteError !== undefined}
          onChange={(event) => {
            setNote(event.target.value);
          }}
        />
      </FormField>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? tForms('saving') : t('saveException')}
        </Button>
        <Button type="button" variant="ghost" onClick={onDone}>
          {t('cancel')}
        </Button>
        <FormStatus
          formError={state.formError}
          hasFieldErrors={Object.keys(state.fieldErrors).length > 0}
          saved={false}
          fixErrorsLabel={tForms('fixErrors')}
          savedLabel={tForms('saved')}
        />
      </div>
    </form>
  );
}

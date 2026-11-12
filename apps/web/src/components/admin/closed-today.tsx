'use client';

import { CircleX } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState, useTransition, type SubmitEvent } from 'react';
import { closedTodayAction, deleteHoursExceptionAction } from '@/app/admin/actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { BranchHours } from '@/lib/admin-types';
import { errorAt, idleForm, type FormState } from '@/lib/form-errors';
import { useExceptionSummary } from '@/components/hours/exception-summary';

interface Props {
  branchId: string;
  today: string;
  exceptions: BranchHours['exceptions'];
}

/**
 * One tap for a sudden closure (UX13): today's date becomes a closed exception with an
 * optional note. Shown as "Closed today" even when the regular hours are unknown (UX4).
 */
export function ClosedToday({ branchId, today, exceptions }: Props) {
  const t = useTranslations('AdminHours');
  const summary = useExceptionSummary();
  const [note, setNote] = useState('');
  const [state, setState] = useState<FormState>(idleForm);
  const [pending, startTransition] = useTransition();

  const todayException = exceptions.find((exception) => exception.date === today);

  function onSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    startTransition(async () => {
      const result = await closedTodayAction(branchId, note);
      setState(result);
      if (result.status === 'saved') setNote('');
    });
  }

  const error = state.formError ?? errorAt(state, 'note') ?? errorAt(state, 'date');

  return (
    <section
      aria-labelledby="closed-today-heading"
      className="flex flex-col gap-3 rounded-lg border bg-muted/50 p-4"
    >
      <div className="flex flex-col gap-1">
        <h2 id="closed-today-heading" className="flex items-center gap-2 font-semibold">
          <CircleX aria-hidden className="size-5 text-status-closed" />
          {t('closedTodayTitle')}
        </h2>
        <p className="text-sm text-muted-foreground">{t('closedTodayHint')}</p>
      </div>

      {todayException === undefined ? (
        <form onSubmit={onSubmit} className="flex flex-wrap items-center gap-2">
          <Input
            aria-label={t('closedTodayNote')}
            placeholder={t('closedTodayNote')}
            className="w-80 bg-background"
            maxLength={200}
            value={note}
            onChange={(event) => {
              setNote(event.target.value);
            }}
          />
          <Button type="submit" variant="destructive" disabled={pending}>
            {t('markClosedToday')}
          </Button>
        </form>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-sm font-medium">
            {t('todayException', { summary: summary(todayException) })}
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={pending}
            onClick={() => {
              startTransition(async () => {
                setState(await deleteHoursExceptionAction(branchId, today));
              });
            }}
          >
            {t('removeTodayException')}
          </Button>
        </div>
      )}

      {state.status === 'error' && error !== undefined && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </section>
  );
}

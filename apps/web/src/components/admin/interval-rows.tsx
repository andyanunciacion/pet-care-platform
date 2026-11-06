'use client';

import { Plus, Trash2 } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { isCompleteTime, isOvernight, wallTimeLabel } from '@/lib/hours-format';

export interface IntervalRow {
  /** React list key. Rows from the page use their position; new rows get a random id. */
  key: string;
  /** "HH:MM", or "" while the time input is incomplete. */
  opensAt: string;
  closesAt: string;
}

export const newIntervalRow = (opensAt = '', closesAt = ''): IntervalRow => ({
  key: crypto.randomUUID(),
  opensAt,
  closesAt,
});

interface Props {
  rows: IntervalRow[];
  onChange: (rows: IntervalRow[]) => void;
  /** Accessible name of a row, e.g. "Monday, interval 2". */
  rowLabel: (index: number) => string;
  errorFor: (index: number) => string | undefined;
  disabled?: boolean;
}

/** Opening intervals of one day: time pairs, with "until 2 AM next day" for overnight ones. */
export function IntervalRows({ rows, onChange, rowLabel, errorFor, disabled = false }: Props) {
  const t = useTranslations('AdminHours');
  const tHours = useTranslations('Hours');
  const locale = useLocale();

  const update = (index: number, patch: Partial<IntervalRow>) => {
    onChange(rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  };

  return (
    <div className="flex flex-col gap-2">
      {rows.map((row, index) => {
        const error = errorFor(index);
        const errorId = `interval-${row.key}-error`;
        const overnight =
          isCompleteTime(row.opensAt) && isCompleteTime(row.closesAt) && isOvernight(row);
        return (
          <div key={row.key} className="flex flex-col gap-1">
            <div role="group" aria-label={rowLabel(index)} className="flex items-center gap-2">
              <Input
                type="time"
                aria-label={t('opensAt')}
                className="w-32"
                value={row.opensAt}
                disabled={disabled}
                aria-invalid={error !== undefined}
                aria-describedby={error === undefined ? undefined : errorId}
                onChange={(event) => {
                  update(index, { opensAt: event.target.value });
                }}
              />
              <span aria-hidden>–</span>
              <Input
                type="time"
                aria-label={t('closesAt')}
                className="w-32"
                value={row.closesAt}
                disabled={disabled}
                aria-invalid={error !== undefined}
                aria-describedby={error === undefined ? undefined : errorId}
                onChange={(event) => {
                  update(index, { closesAt: event.target.value });
                }}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={t('removeInterval')}
                disabled={disabled}
                onClick={() => {
                  onChange(rows.filter((_, i) => i !== index));
                }}
              >
                <Trash2 aria-hidden />
              </Button>
              {overnight && (
                <span className="text-sm text-muted-foreground">
                  {tHours('untilNextDay', { time: wallTimeLabel(row.closesAt, locale) })}
                </span>
              )}
            </div>
            {error !== undefined && (
              <p id={errorId} className="text-sm text-destructive">
                {error}
              </p>
            )}
          </div>
        );
      })}
      <div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          onClick={() => {
            onChange([...rows, newIntervalRow()]);
          }}
        >
          <Plus aria-hidden />
          {t('addInterval')}
        </Button>
      </div>
    </div>
  );
}

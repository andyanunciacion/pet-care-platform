'use client';

import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import { CONTACT_TYPES, type ContactType } from '@/lib/admin-types';

export interface ContactRow {
  /** A client-side id for React's list keys (rows have no database id until saved). */
  key: string;
  type: ContactType;
  value: string;
  label: string;
}

export const newContactRow = (type: ContactType = 'phone'): ContactRow => ({
  key: crypto.randomUUID(),
  type,
  value: '',
  label: '',
});

interface Props {
  rows: ContactRow[];
  onChange: (rows: ContactRow[]) => void;
  /** Error for a row's field, by index: errorFor(1, 'value'). */
  errorFor: (index: number, field: 'type' | 'value' | 'label') => string | undefined;
}

const inputMode = { phone: 'tel', viber: 'tel', messenger: 'url', email: 'email' } as const;

/** The branch's phones, Viber, Messenger and email, in display order. */
export function ContactsEditor({ rows, onChange, errorFor }: Props) {
  const t = useTranslations('AdminForms');
  const tEnums = useTranslations('Enums');

  const update = (index: number, patch: Partial<ContactRow>) => {
    onChange(rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  };
  const move = (index: number, by: -1 | 1) => {
    const next = [...rows];
    const [row] = next.splice(index, 1);
    if (row === undefined) return;
    next.splice(index + by, 0, row);
    onChange(next);
  };

  return (
    <div className="flex flex-col gap-3">
      {rows.length === 0 && <p className="text-sm text-muted-foreground">{t('noContacts')}</p>}
      {rows.map((row, index) => {
        const valueError = errorFor(index, 'value');
        const labelError = errorFor(index, 'label');
        const id = `contact-${row.key}`;
        return (
          <fieldset key={row.key} className="flex flex-col gap-1.5">
            <legend className="sr-only">
              {tEnums(`contactType.${row.type}`)} {index + 1}
            </legend>
            <div className="flex flex-wrap items-start gap-2">
              <NativeSelect
                aria-label={t('contactType')}
                value={row.type}
                onChange={(event) => {
                  update(index, { type: event.target.value as ContactType });
                }}
              >
                {CONTACT_TYPES.map((type) => (
                  <NativeSelectOption key={type} value={type}>
                    {tEnums(`contactType.${type}`)}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
              <Input
                id={`${id}-value`}
                aria-label={t('contactValue')}
                className="w-72"
                inputMode={inputMode[row.type]}
                value={row.value}
                aria-invalid={valueError !== undefined}
                aria-describedby={valueError === undefined ? undefined : `${id}-error`}
                onChange={(event) => {
                  update(index, { value: event.target.value });
                }}
              />
              <Input
                aria-label={t('contactLabel')}
                placeholder={t('contactLabelPlaceholder')}
                className="w-44"
                maxLength={50}
                value={row.label}
                aria-invalid={labelError !== undefined}
                onChange={(event) => {
                  update(index, { label: event.target.value });
                }}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={t('moveUp')}
                disabled={index === 0}
                onClick={() => {
                  move(index, -1);
                }}
              >
                <ArrowUp aria-hidden />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={t('moveDown')}
                disabled={index === rows.length - 1}
                onClick={() => {
                  move(index, 1);
                }}
              >
                <ArrowDown aria-hidden />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={t('remove')}
                onClick={() => {
                  onChange(rows.filter((_, i) => i !== index));
                }}
              >
                <Trash2 aria-hidden />
              </Button>
            </div>
            {(valueError ?? labelError) !== undefined && (
              <p id={`${id}-error`} className="text-sm text-destructive">
                {valueError ?? labelError}
              </p>
            )}
          </fieldset>
        );
      })}
      <div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            onChange([...rows, newContactRow()]);
          }}
        >
          <Plus aria-hidden />
          {t('addContact')}
        </Button>
      </div>
    </div>
  );
}

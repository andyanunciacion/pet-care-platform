'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useId, useRef, useState, useTransition } from 'react';
import { importCsvAction } from '@/app/admin/actions';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { ImportedBusiness, ImportResult } from '@/lib/admin-types';

/** The API's limit (characters), checked here first so a big file fails with a clear message. */
const MAX_CSV_LENGTH = 500_000;

const statusVariant = {
  new: 'default',
  duplicate: 'secondary',
  invalid: 'destructive',
  imported: 'default',
  skipped: 'outline',
} as const satisfies Record<ImportedBusiness['status'], string>;

type Message = { text: string; error: boolean } | null;

/**
 * CSV import (ARCHITECTURE D39): choosing a file runs a dry run, which lists every row with
 * its problems and likely duplicates; "Import" sends the same file again for real.
 */
export function CsvImport() {
  const t = useTranslations('AdminImport');
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [csv, setCsv] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [importAnyway, setImportAnyway] = useState<ReadonlySet<string>>(new Set());
  const [message, setMessage] = useState<Message>(null);
  const [pending, startTransition] = useTransition();

  /** Forgets the last file's results (the file input keeps showing the chosen file). */
  function clearResults() {
    setCsv(null);
    setResult(null);
    setImportAnyway(new Set());
    setMessage(null);
  }

  /** Back to the start: no results, and no file chosen. */
  function reset() {
    clearResults();
    if (inputRef.current !== null) inputRef.current.value = '';
  }

  function run(text: string, dryRun: boolean) {
    setMessage(null);
    startTransition(async () => {
      const { state, result: next } = await importCsvAction({
        csv: text,
        dryRun,
        // Only the confirm uses it (a dry run reports duplicates either way).
        importAnyway: dryRun ? [] : [...importAnyway],
      });
      if (next === null) {
        setMessage({
          text: state.formError ?? (dryRun ? t('checkFailed') : t('importFailed')),
          error: true,
        });
        return;
      }
      setResult(next);
      if (!dryRun) {
        const count = next.businesses.filter((b) => b.status === 'imported').length;
        setMessage({ text: t('done', { count }), error: false });
      }
    });
  }

  async function choose(file: File | undefined) {
    clearResults();
    if (file === undefined) return;
    let text: string;
    try {
      text = await file.text();
    } catch {
      setMessage({ text: t('readFailed'), error: true });
      return;
    }
    if (text.length > MAX_CSV_LENGTH) {
      setMessage({ text: t('tooLarge'), error: true });
      return;
    }
    setCsv(text);
    run(text, true);
  }

  const businesses = result?.businesses ?? [];
  const count = (status: ImportedBusiness['status']) =>
    businesses.filter((b) => b.status === status).length;
  const toImport =
    count('new') +
    businesses.filter((b) => b.status === 'duplicate' && importAnyway.has(b.key)).length;
  const done = result !== null && !result.dryRun;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={inputId}>{t('file')}</Label>
          <input
            ref={inputRef}
            id={inputId}
            type="file"
            accept=".csv,text/csv"
            disabled={pending}
            className="text-sm file:mr-3 file:rounded-md file:border file:bg-background file:px-3 file:py-1.5 file:text-sm file:font-medium"
            onChange={(event) => {
              void choose(event.target.files?.[0]);
            }}
          />
        </div>
        {pending && (
          <p role="status" className="text-sm text-muted-foreground">
            {result === null ? t('checking') : t('importing')}
          </p>
        )}
      </div>

      {message !== null && (
        <p
          role={message.error ? 'alert' : 'status'}
          className={`text-sm ${message.error ? 'text-destructive' : 'text-status-open'}`}
        >
          {message.text}
        </p>
      )}

      {result !== null && result.fileErrors.length > 0 && (
        <div role="alert" className="rounded-md border border-destructive p-4 text-sm">
          <p className="font-medium text-destructive">{t('fileErrors')}</p>
          <ul className="mt-1 list-disc pl-5">
            {result.fileErrors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        </div>
      )}

      {result !== null && result.warnings.length > 0 && (
        <ul className="text-sm text-muted-foreground">
          {result.warnings.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      )}

      {businesses.length > 0 && (
        <>
          {!done && (
            <div className="flex flex-col gap-1 text-sm">
              <p className="font-medium">
                {[
                  t('summaryNew', { count: count('new') }),
                  t('summaryDuplicates', { count: count('duplicate') }),
                  t('summaryInvalid', { count: count('invalid') }),
                ].join(' · ')}
              </p>
              <p className="text-muted-foreground">{t('summaryHint')}</p>
            </div>
          )}

          <Table aria-label={t('resultsLabel')}>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">{t('columns.row')}</TableHead>
                <TableHead>{t('columns.branch')}</TableHead>
                <TableHead>{t('columns.city')}</TableHead>
                <TableHead>{t('columns.problems')}</TableHead>
              </TableRow>
            </TableHeader>
            {businesses.map((entry) => (
              <BusinessRows
                key={entry.key}
                entry={entry}
                canForce={!done}
                forced={importAnyway.has(entry.key)}
                onForce={(checked) => {
                  setImportAnyway((current) => {
                    const next = new Set(current);
                    if (checked) next.add(entry.key);
                    else next.delete(entry.key);
                    return next;
                  });
                }}
              />
            ))}
          </Table>
        </>
      )}

      {csv !== null && result !== null && (
        <div className="flex flex-wrap items-center gap-3">
          {!done && result.fileErrors.length === 0 && (
            <Button
              type="button"
              disabled={pending || toImport === 0}
              onClick={() => {
                run(csv, false);
              }}
            >
              {toImport === 0 ? t('nothingToImport') : t('confirm', { count: toImport })}
            </Button>
          )}
          <Button type="button" variant="outline" disabled={pending} onClick={reset}>
            {done ? t('another') : t('cancel')}
          </Button>
        </div>
      )}
    </div>
  );
}

/** One business: a header row (name, status, duplicates), then one row per branch. */
function BusinessRows({
  entry,
  canForce,
  forced,
  onForce,
}: {
  entry: ImportedBusiness;
  canForce: boolean;
  forced: boolean;
  onForce: (checked: boolean) => void;
}) {
  const t = useTranslations('AdminImport');
  const checkboxId = useId();

  return (
    <TableBody className="border-b-2">
      <TableRow className="bg-muted/50 hover:bg-muted/50">
        <TableCell colSpan={4} className="whitespace-normal">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="font-medium">{entry.name === '' ? t('noName') : entry.name}</span>
            <Badge variant={statusVariant[entry.status]}>{t(`status.${entry.status}`)}</Badge>
            {entry.businessId !== null && (
              <Link
                href={`/admin/businesses/${entry.businessId}`}
                className="text-sm text-primary hover:underline"
              >
                {t('open')}
              </Link>
            )}
          </div>
          {entry.errors.length > 0 && <Problems errors={entry.errors} />}
          {entry.duplicates.length > 0 && (
            <div className="mt-2 flex flex-col gap-1 text-sm">
              <p className="text-muted-foreground">{t('sameAs')}</p>
              <ul className="list-disc pl-5">
                {entry.duplicates.map((duplicate, i) => (
                  <li key={i}>
                    {duplicate.businessId === null ? (
                      t('dupInFile', {
                        row: duplicate.row ?? 0,
                        business: duplicate.businessName,
                        branch: duplicate.branchName,
                      })
                    ) : (
                      <Link
                        href={`/admin/businesses/${duplicate.businessId}`}
                        className="text-primary hover:underline"
                      >
                        {duplicate.businessName}, {duplicate.branchName}
                      </Link>
                    )}{' '}
                    <span className="text-muted-foreground">
                      (
                      {duplicate.reason === 'phone'
                        ? t('dupPhone', { phone: duplicate.phone ?? '' })
                        : t('dupNearby', { distance: duplicate.distanceMeters ?? 0 })}
                      )
                    </span>
                  </li>
                ))}
              </ul>
              {canForce && entry.status === 'duplicate' && (
                <div className="flex items-center gap-2">
                  <Checkbox
                    id={checkboxId}
                    checked={forced}
                    onCheckedChange={(checked) => {
                      onForce(checked === true);
                    }}
                  />
                  <Label htmlFor={checkboxId} className="font-normal">
                    {t('importAnyway')}
                  </Label>
                </div>
              )}
            </div>
          )}
        </TableCell>
      </TableRow>
      {entry.rows.map((row) => (
        <TableRow key={row.row} className="align-top">
          <TableCell className="tabular-nums text-muted-foreground">{row.row}</TableCell>
          <TableCell>{row.branch}</TableCell>
          <TableCell>{row.city}</TableCell>
          <TableCell className="whitespace-normal">
            <Problems errors={row.errors} />
          </TableCell>
        </TableRow>
      ))}
    </TableBody>
  );
}

function Problems({ errors }: { errors: ImportedBusiness['errors'] }) {
  if (errors.length === 0) return null;
  return (
    <ul className="mt-1 flex flex-col gap-0.5 text-sm text-destructive">
      {errors.map((error, i) => (
        <li key={i}>
          {error.column !== null && <code className="font-mono text-xs">{error.column}</code>}
          {error.column !== null && ': '}
          {error.message}
        </li>
      ))}
    </ul>
  );
}

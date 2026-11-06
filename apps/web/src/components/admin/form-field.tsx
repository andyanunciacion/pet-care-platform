import type { ReactNode } from 'react';
import { Label } from '@/components/ui/label';

interface Props {
  /** The id of the input inside; the label and messages point at it. */
  id: string;
  label: string;
  hint?: string;
  error?: string | undefined;
  /** Shown after the label, e.g. "(optional)". */
  labelSuffix?: string;
  children: ReactNode;
}

/**
 * Label + input + hint + error, wired for screen readers: give the input
 * `aria-describedby={describedBy(id, hint, error)}` and `aria-invalid={error !== undefined}`.
 */
export function FormField({ id, label, hint, error, labelSuffix, children }: Props) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>
        {label}
        {labelSuffix !== undefined && (
          <span className="font-normal text-muted-foreground">({labelSuffix})</span>
        )}
      </Label>
      {children}
      {hint !== undefined && (
        <p id={`${id}-hint`} className="text-sm text-muted-foreground">
          {hint}
        </p>
      )}
      {error !== undefined && (
        <p id={`${id}-error`} className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

export function describedBy(id: string, hint?: string, error?: string): string | undefined {
  const ids = [hint !== undefined && `${id}-hint`, error !== undefined && `${id}-error`].filter(
    Boolean,
  );
  return ids.length === 0 ? undefined : ids.join(' ');
}

/** The status line under a form's Save button. */
export function FormStatus({
  formError,
  hasFieldErrors,
  saved,
  fixErrorsLabel,
  savedLabel,
}: {
  formError: string | null;
  hasFieldErrors: boolean;
  saved: boolean;
  fixErrorsLabel: string;
  savedLabel: string;
}) {
  const message = formError ?? (hasFieldErrors ? fixErrorsLabel : saved ? savedLabel : null);
  if (message === null) return <p aria-live="polite" className="sr-only" />;
  return (
    <p
      aria-live="polite"
      role={formError !== null || hasFieldErrors ? 'alert' : undefined}
      className={
        formError !== null || hasFieldErrors
          ? 'text-sm text-destructive'
          : 'text-sm text-status-open'
      }
    >
      {message}
    </p>
  );
}

'use client';

import { LoaderCircle } from 'lucide-react';
import { useLinkStatus } from 'next/link';
import type { ReactNode } from 'react';
import { useFormStatus } from 'react-dom';
import { cn } from '@/lib/utils';

// Feedback where the owner tapped while the next search page loads. The search pages have
// no loading.tsx: a streamed "Searching…" fallback first made Lighthouse's simulated phone
// count the scripts as blocking the results (LCP 2.7 s against the 2.5 s budget, DESIGN §9),
// so each control says it's working instead.

/** Inside a `<Link>`: its icon turns into a spinner while that navigation is pending. */
export function LinkPending({ children, className }: { children: ReactNode; className?: string }) {
  const { pending } = useLinkStatus();
  if (!pending) return children;
  return (
    <LoaderCircle
      aria-hidden
      className={cn('shrink-0 animate-spin motion-reduce:animate-none', className)}
    />
  );
}

/** A form's submit button that shows a spinner and `pendingLabel` while it submits (next/form). */
export function SubmitPending({
  children,
  pendingLabel,
  className,
}: {
  children: ReactNode;
  pendingLabel: string;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" aria-disabled={pending} className={className}>
      {pending ? (
        <>
          <LoaderCircle aria-hidden className="size-5 animate-spin motion-reduce:animate-none" />
          {pendingLabel}
        </>
      ) : (
        children
      )}
    </button>
  );
}

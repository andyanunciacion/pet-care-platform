'use client';

import { HeartPulse } from 'lucide-react';
import Link from 'next/link';
import { useNow } from '@/components/hours/use-now';
import { isNightInManila } from '@/lib/search-filters';
import { LinkPending } from './pending';

/**
 * The zero-results offer of emergency clinics, shown only at night (DESIGN UX12). It depends
 * on the time, so it appears once the browser knows it (UX20).
 */
export function NightEmergencyLink({ href, label }: { href: string; label: string }) {
  const now = useNow();
  if (now === null || !isNightInManila(now)) return null;
  return (
    <li>
      <Link
        href={href}
        className="inline-flex min-h-11 items-center gap-1.5 font-bold text-emergency underline underline-offset-4 hover:decoration-2"
      >
        <LinkPending className="size-5">
          <HeartPulse aria-hidden className="size-5 shrink-0" />
        </LinkPending>
        {label}
      </Link>
    </li>
  );
}

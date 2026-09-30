import { PawPrint } from 'lucide-react';
import { brand } from '@/lib/brand';
import { cn } from '@/lib/utils';

/** Placeholder logo (DESIGN.md §7.1): PawPrint icon + bold name, in the primary color. */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span
      className={cn('inline-flex items-center gap-1.5 text-xl font-bold text-primary', className)}
    >
      <PawPrint aria-hidden className="size-6" strokeWidth={2.25} />
      {brand.name}
    </span>
  );
}

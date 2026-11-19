import { PawPrint } from 'lucide-react';
import { brand } from '@/lib/brand';
import { cn } from '@/lib/utils';

/**
 * The logo (DESIGN.md §7.1): PawPrint icon + bold name. `onPrimary` is the white version for
 * the blue header band; otherwise it's booklet blue on white (the login page).
 */
export function Wordmark({
  className,
  onPrimary = false,
}: {
  className?: string;
  onPrimary?: boolean;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 text-2xl font-extrabold tracking-wide',
        onPrimary ? 'text-primary-foreground' : 'text-primary',
        className,
      )}
    >
      <PawPrint aria-hidden className="size-7" strokeWidth={2.25} />
      {brand.name}
    </span>
  );
}

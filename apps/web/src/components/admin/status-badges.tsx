import { Badge } from '@/components/ui/badge';
import type { ClaimStatus, ListingStatus } from '@/lib/admin-types';

// Status as text in a badge (never color alone). Labels come from the caller's translations.

const listingVariant = {
  published: 'default',
  hidden: 'outline',
  permanently_closed: 'destructive',
} as const satisfies Record<ListingStatus, string>;

export function ListingStatusBadge({ status, label }: { status: ListingStatus; label: string }) {
  return <Badge variant={listingVariant[status]}>{label}</Badge>;
}

export function ClaimStatusBadge({ status, label }: { status: ClaimStatus; label: string }) {
  if (status === 'verified') {
    return <Badge className="bg-verified text-primary-foreground">{label}</Badge>;
  }
  return <Badge variant={status === 'pending' ? 'secondary' : 'outline'}>{label}</Badge>;
}

import { BadgeCheck, Info } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import type { ListingBusiness } from '@/lib/public-types';

/**
 * Verified: a badge that explains itself on tap. Unclaimed (most listings at first): a quiet
 * "Listed by PAW" that doesn't look broken (DESIGN UX6). A native <details>, so no JavaScript.
 */
export async function ClaimBadge({ claimStatus }: Pick<ListingBusiness, 'claimStatus'>) {
  const t = await getTranslations('Listing');
  const verified = claimStatus === 'verified';
  return (
    <details className="group text-sm">
      <summary
        className={
          verified
            ? 'inline-flex min-h-11 cursor-pointer list-none items-center gap-1.5 rounded-md font-semibold text-verified [&::-webkit-details-marker]:hidden'
            : 'inline-flex min-h-11 cursor-pointer list-none items-center gap-1.5 rounded-md text-muted-foreground [&::-webkit-details-marker]:hidden'
        }
      >
        {verified ? (
          <BadgeCheck aria-hidden className="size-5" />
        ) : (
          <Info aria-hidden className="size-4" />
        )}
        <span className="underline decoration-dotted underline-offset-4">
          {verified ? t('verified') : t('listedByPaw')}
        </span>
      </summary>
      <p className="max-w-prose pb-2 text-muted-foreground">
        {verified ? t('verifiedExplain') : t('listedByPawExplain')}
      </p>
    </details>
  );
}

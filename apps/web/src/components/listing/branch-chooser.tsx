import { getTranslations } from 'next-intl/server';
import { isClosedForGood } from '@/lib/listing';
import type { Listing } from '@/lib/public-types';
import { ClaimBadge } from './claim-badge';
import { ListingMessages } from './listing-messages';
import { BranchSummary, ClosedNotice, Section } from './sections';

/** A business with several branches: each one with its status and a Call button. */
export async function BranchChooser({
  listing,
  renderedAt,
}: {
  listing: Listing;
  renderedAt: string;
}) {
  const t = await getTranslations('Listing');
  const { business } = listing;
  const closedForGood = isClosedForGood(business);

  return (
    <ListingMessages>
      <div className="flex flex-col gap-10">
        <header className="flex flex-col gap-3">
          <h1 className="text-[length:clamp(1.75rem,1.4rem+1.6vw,2.5rem)] leading-tight font-extrabold tracking-tight text-balance">
            {business.name}
          </h1>
          <ClaimBadge claimStatus={business.claimStatus} />
          {closedForGood && <ClosedNotice detail={t('businessClosedDetail')} />}
          {business.description !== null && (
            <p className="max-w-prose whitespace-pre-line">{business.description}</p>
          )}
        </header>

        <Section id="branches" title={t('branchesTitle')}>
          <ul className="grid gap-3 sm:grid-cols-2">
            {listing.branches.map((branch) => (
              <BranchSummary
                key={branch.id}
                branch={branch}
                renderedAt={renderedAt}
                showCall={!closedForGood}
              />
            ))}
          </ul>
        </Section>
      </div>
    </ListingMessages>
  );
}

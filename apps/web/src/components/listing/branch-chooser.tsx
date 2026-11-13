import { getTranslations } from 'next-intl/server';
import { serverEnv } from '@/lib/env';
import { businessJsonLd } from '@/lib/json-ld';
import { isClosedForGood, shownImage } from '@/lib/listing';
import type { Listing } from '@/lib/public-types';
import { ClaimBadge } from './claim-badge';
import { JsonLd } from './json-ld';
import { ListingMessages } from './listing-messages';
import { BranchSummary, BusinessLogo, ClosedNotice, Section } from './sections';

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
      {!closedForGood && (
        <JsonLd
          data={businessJsonLd({
            listing,
            siteUrl: serverEnv().SITE_URL,
            logo: shownImage(business.logo),
          })}
        />
      )}
      <div className="flex flex-col gap-10">
        <header className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <BusinessLogo business={business} />
            <h1 className="min-w-0 text-[length:clamp(1.75rem,1.5rem+1vw,2rem)] leading-tight font-bold tracking-tight text-balance">
              {business.name}
            </h1>
          </div>
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

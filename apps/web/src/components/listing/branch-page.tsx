import { hasHoursData } from '@paw/domain';
import { getTranslations } from 'next-intl/server';
import { addressLabel, branchHours, isClosedForGood } from '@/lib/listing';
import type { Listing, ListingBranch } from '@/lib/public-types';
import { ClaimBadge } from './claim-badge';
import { ContactBar } from './contact-bar';
import { HoursTable } from './hours-table';
import { ListingMessages } from './listing-messages';
import { LiveFreshness, LiveStatus } from './live-status';
import {
  AddressSection,
  BranchSummary,
  ClosedNotice,
  ContactSection,
  Emergencies,
  Section,
  ServicesSection,
  SpeciesLine,
} from './sections';

/**
 * A branch's full page (DESIGN UX8): header with species, status and freshness → sticky
 * contact bar → services and prices → hours → other branches. Photos come with P1-4b; the
 * report link and claim CTA with P1-7 and P1-8.
 */
export async function BranchPage({
  listing,
  branch,
  renderedAt,
}: {
  listing: Listing;
  branch: ListingBranch;
  renderedAt: string;
}) {
  const t = await getTranslations('Listing');
  const tHours = await getTranslations('Hours');
  const { business } = listing;
  const several = listing.branches.length > 1;
  const closedForGood = isClosedForGood(business) || isClosedForGood(branch);
  const hours = branchHours(branch);
  const others = listing.branches.filter((other) => other.id !== branch.id);
  // "Hours not confirmed yet" under "Hours unknown" says the same thing twice.
  const showFreshness = hasHoursData(hours) || branch.hoursConfirmedAt !== null;

  return (
    <ListingMessages>
      {/*
        The contact bar comes first in the HTML, so keyboard and screen-reader users reach
        Call right after the header; it's fixed to the bottom of the screen either way.
        The page leaves room for it at the bottom (pb-28).
      */}
      <div className={closedForGood ? 'flex flex-col gap-10' : 'flex flex-col gap-10 pb-28'}>
        <header className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <h1 className="text-[length:clamp(1.75rem,1.4rem+1.6vw,2.5rem)] leading-tight font-extrabold tracking-tight text-balance">
              {business.name}
            </h1>
            {several && <p className="text-lg font-medium">{branch.name}</p>}
            <p className="text-pretty text-muted-foreground">{addressLabel(branch)}</p>
          </div>
          <SpeciesLine species={branch.species} />
          <ClaimBadge claimStatus={business.claimStatus} />

          {closedForGood ? (
            <ClosedNotice
              detail={
                isClosedForGood(business) ? t('businessClosedDetail') : t('branchClosedDetail')
              }
            />
          ) : (
            <div className="flex min-h-24 flex-col justify-center gap-2 rounded-xl border p-4 text-lg">
              <LiveStatus hours={hours} renderedAt={renderedAt} />
              {branch.acceptsEmergencies && <Emergencies branch={branch} />}
              {showFreshness && (
                <LiveFreshness
                  confirmedAt={branch.hoursConfirmedAt}
                  confirmedBy={branch.hoursConfirmedBy}
                />
              )}
            </div>
          )}

          {business.description !== null && (
            <p className="max-w-prose whitespace-pre-line">{business.description}</p>
          )}
        </header>

        {!closedForGood && (
          <ContactBar branch={branch} label={t('contactBarLabel', { name: business.name })} />
        )}

        {/*
          Desktop: services | a bordered panel with hours, contact and address, so the practical
          info reads as one block beside the services. Mobile: one column in that order, no
          panel (the sections stack under their own headings, and the hours table needs the width).
        */}
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
          <ServicesSection services={branch.services} />
          <div className="flex flex-col gap-10 lg:gap-8 lg:rounded-xl lg:border lg:p-5">
            <Section id="hours" title={tHours('weekTitle')}>
              <HoursTable hours={hours} renderedAt={renderedAt} />
            </Section>
            <ContactSection branch={branch} />
            <AddressSection branch={branch} />
          </div>
        </div>

        {others.length > 0 && (
          <Section id="other-branches" title={t('otherBranchesTitle')}>
            <ul className="grid gap-3 sm:grid-cols-2">
              {others.map((other) => (
                <BranchSummary key={other.id} branch={other} renderedAt={renderedAt} />
              ))}
            </ul>
          </Section>
        )}
      </div>
    </ListingMessages>
  );
}

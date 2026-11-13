import { hasHoursData } from '@paw/domain';
import { ChevronRight } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { contactReach } from '@/lib/contact-links';
import { serverEnv } from '@/lib/env';
import { branchJsonLd } from '@/lib/json-ld';
import { addressLabel, branchHours, isClosedForGood, shownImage, shownPhotos } from '@/lib/listing';
import type { Listing, ListingBranch } from '@/lib/public-types';
import { ClaimBadge } from './claim-badge';
import { ContactBar } from './contact-bar';
import { HoursTable } from './hours-table';
import { JsonLd } from './json-ld';
import { ListingMessages } from './listing-messages';
import { LiveFreshness, LiveStatus } from './live-status';
import { PhotoStrip } from './photos';
import {
  AddressSection,
  BranchSummary,
  BusinessLogo,
  ClosedNotice,
  ContactSection,
  Emergencies,
  ProductsSection,
  Section,
  ServicesSection,
  SpeciesLine,
} from './sections';

/**
 * A branch's full page (DESIGN UX8): header (logo, name, species, then the status card with
 * the status as its largest line) → sticky contact bar → services and prices → products →
 * hours → photos → other branches, plus its structured data (JSON-LD). The report link and
 * claim CTA come with P1-7 and P1-8.
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
  const photos = shownPhotos(branch);
  const reach = contactReach(branch.contacts);
  // Verified is a badge by the name (UX6); "Listed by PAW" matters less than the status, so it
  // follows the status card instead of pushing it down.
  const verified = business.claimStatus === 'verified';
  const claimBadge = <ClaimBadge claimStatus={business.claimStatus} />;

  return (
    <ListingMessages>
      {/* A closed listing isn't indexed (noindex), so it says nothing to search engines. */}
      {!closedForGood && (
        <JsonLd
          data={branchJsonLd({
            listing,
            branch,
            siteUrl: serverEnv().SITE_URL,
            photos,
            logo: shownImage(business.logo),
          })}
        />
      )}
      {/*
        The contact bar comes first in the HTML, so keyboard and screen-reader users reach
        Call right after the header; it's fixed to the bottom of the screen either way.
        The page leaves room for it at the bottom (pb-28).
      */}
      <div className={closedForGood ? 'flex flex-col gap-10' : 'flex flex-col gap-10 pb-28'}>
        <header className="flex flex-col gap-3">
          <div className="flex items-start gap-3">
            <BusinessLogo business={business} />
            <div className="flex min-w-0 flex-col gap-1">
              {/* The headline size (DESIGN.md): big enough to lead, small enough that a long name
                  leaves the status card above the fold on a phone. */}
              <h1 className="text-[length:clamp(1.75rem,1.5rem+1vw,2rem)] leading-tight font-bold tracking-tight text-balance">
                {business.name}
              </h1>
              {several && <p className="text-lg font-medium">{branch.name}</p>}
              <p className="text-pretty text-muted-foreground">{addressLabel(branch)}</p>
            </div>
          </div>
          <SpeciesLine species={branch.species} />
          {verified && claimBadge}

          {closedForGood ? (
            <ClosedNotice
              detail={
                isClosedForGood(business) ? t('businessClosedDetail') : t('branchClosedDetail')
              }
            />
          ) : (
            // "Can I go there now?" (DESIGN §2 principle 1): the status is the card's largest
            // line. A heading only screen readers see lets them jump here like to any section.
            <section
              aria-labelledby="status"
              className="flex min-h-24 flex-col justify-center gap-2 rounded-xl border p-4 text-lg lg:max-w-xl"
            >
              <h2 id="status" className="sr-only">
                {t('statusTitle')}
              </h2>
              <LiveStatus hours={hours} renderedAt={renderedAt} reach={reach} className="text-xl" />
              {branch.acceptsEmergencies && <Emergencies branch={branch} />}
              {showFreshness && (
                <LiveFreshness
                  confirmedAt={branch.hoursConfirmedAt}
                  confirmedBy={branch.hoursConfirmedBy}
                />
              )}
              {/* On phones the week is far below the services; on desktop it's beside them. */}
              {hasHoursData(hours) && (
                <a
                  href="#hours"
                  className="inline-flex min-h-11 items-center gap-1 self-start text-base font-medium text-primary underline underline-offset-4 hover:decoration-2 lg:hidden"
                >
                  {t('seeAllHours')}
                  <ChevronRight aria-hidden className="size-5" />
                </a>
              )}
            </section>
          )}
          {!verified && claimBadge}

          {business.description !== null && (
            <p className="max-w-prose whitespace-pre-line">{business.description}</p>
          )}
        </header>

        {!closedForGood && (
          <ContactBar branch={branch} label={t('contactBarLabel', { name: business.name })} />
        )}

        {/*
          Desktop: services and products | a bordered panel with hours, contact and address, so
          the practical info reads as one block beside them. Mobile: one column in that order,
          no panel (the sections stack under their own headings, and the hours table needs the
          width). Photos follow, full width.
        */}
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
          <div className="flex flex-col gap-10">
            <ServicesSection services={branch.services} reach={reach} />
            <ProductsSection products={business.products} reach={reach} />
          </div>
          <div className="flex flex-col gap-10 lg:gap-8 lg:rounded-xl lg:border lg:p-5">
            <Section id="hours" title={tHours('weekTitle')}>
              <HoursTable hours={hours} renderedAt={renderedAt} />
            </Section>
            <ContactSection branch={branch} />
            <AddressSection branch={branch} />
          </div>
        </div>

        <PhotoStrip
          photos={photos}
          name={several ? `${business.name} ${branch.name}` : business.name}
        />

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

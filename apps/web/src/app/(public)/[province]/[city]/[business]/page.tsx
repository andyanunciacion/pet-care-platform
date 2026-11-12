import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { BranchChooser } from '@/components/listing/branch-chooser';
import { BranchPage } from '@/components/listing/branch-page';
import { isClosedForGood, loadListing } from '@/lib/listing';

// A business's page (ARCHITECTURE §8): the full clinic page when it has one branch, or the
// list of its branches. Looked up by the business slug alone (unique across PAW); any other
// spelling of the province or city redirects to the canonical URL.

interface Params {
  province: string;
  city: string;
  business: string;
}

// An empty list = no page is built at build time; each one is rendered on its first visit
// and then served from the cache until an admin edit invalidates it (ISR, D41).
export function generateStaticParams(): Params[] {
  return [];
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const listing = await loadListing((await params).business.toLowerCase());
  if (listing === null) return {};
  const t = await getTranslations('Listing');
  const { business, branches } = listing;
  const [only] = branches;
  return {
    title:
      branches.length === 1 && only !== undefined
        ? t('metaTitle', { name: business.name, city: only.city.name })
        : business.name,
    description:
      branches.length === 1 && only !== undefined
        ? t('metaDescription', { name: business.name, city: only.city.name })
        : t('metaDescriptionBranches', { name: business.name, count: branches.length }),
    ...(isClosedForGood(business) && { robots: { index: false, follow: true } }),
  };
}

export default async function BusinessPage({ params }: { params: Promise<Params> }) {
  const { province, city, business } = await params;
  const listing = await loadListing(business.toLowerCase());
  if (listing === null) notFound();
  if (`/${province}/${city}/${business}` !== listing.business.path) {
    permanentRedirect(listing.business.path);
  }

  const renderedAt = new Date().toISOString();
  const [only] = listing.branches;
  return listing.branches.length === 1 && only !== undefined ? (
    <BranchPage listing={listing} branch={only} renderedAt={renderedAt} />
  ) : (
    <BranchChooser listing={listing} renderedAt={renderedAt} />
  );
}

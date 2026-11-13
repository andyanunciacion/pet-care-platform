import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { BranchPage } from '@/components/listing/branch-page';
import { isClosedForGood, loadListing, shownImage, shownPhotos } from '@/lib/listing';
import { listingMetadata } from '@/lib/listing-metadata';

// One branch of a business with several (ARCHITECTURE §8), in the branch's own province and
// city. A single-branch business has no branch URLs: this redirects to its business URL.

interface Params {
  province: string;
  city: string;
  business: string;
  branch: string;
}

// Rendered on first visit, then cached until an edit (ISR, D41); see the business page.
export function generateStaticParams(): Params[] {
  return [];
}

async function load(params: Promise<Params>) {
  const { business, branch } = await params;
  const listing = await loadListing(business.toLowerCase());
  const found = listing?.branches.find((b) => b.slug === branch.toLowerCase());
  return listing === null || found === undefined ? null : { listing, branch: found };
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const loaded = await load(params);
  if (loaded === null) return {};
  const t = await getTranslations('Listing');
  const { listing, branch } = loaded;
  const name = `${listing.business.name} – ${branch.name}`;
  return listingMetadata({
    title: t('metaTitle', { name, city: branch.city.name }),
    description: t('metaDescription', { name, city: branch.city.name }),
    path: branch.path,
    image: shownPhotos(branch)[0] ?? shownImage(listing.business.logo),
    closedForGood: isClosedForGood(listing.business) || isClosedForGood(branch),
  });
}

export default async function BranchRoute({ params }: { params: Promise<Params> }) {
  const loaded = await load(params);
  if (loaded === null) notFound();
  const { listing, branch } = loaded;
  const { province, city, business, branch: branchSlug } = await params;
  if (`/${province}/${city}/${business}/${branchSlug}` !== branch.path) {
    permanentRedirect(branch.path);
  }
  return <BranchPage listing={listing} branch={branch} renderedAt={new Date().toISOString()} />;
}

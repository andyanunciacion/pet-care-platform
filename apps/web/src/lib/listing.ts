import { SLUG_PATTERN, type BranchHours } from '@paw/domain';
import { cache } from 'react';
import { serverEnv } from './env';
import { allowedPhoto } from './photos';
import { publicApi } from './public-api';
import type { Listing, ListingBranch, ListingImage } from './public-types';

const SLUG = new RegExp(SLUG_PATTERN);

/**
 * A business's public listing, or null when there's none at that slug (unknown, hidden, or
 * not a slug at all). `cache` shares one call between generateMetadata and the page.
 */
export const loadListing = cache(async (businessSlug: string): Promise<Listing | null> => {
  if (!SLUG.test(businessSlug)) return null;
  const result = await publicApi().GET('/v1/listings/{businessSlug}', {
    params: { path: { businessSlug } },
  });
  if (result.data !== undefined) return result.data;
  if (result.response.status === 404) return null;
  throw new Error(`Unexpected response from the API: ${String(result.response.status)}`);
});

/** A branch's hours in the shape @paw/domain computes the open status from. */
export function branchHours(branch: ListingBranch): BranchHours {
  return { is24h: branch.is24h, weekly: branch.weekly, exceptions: branch.exceptions };
}

/** The address as one line: "Rizal St., Balibago, Angeles City". */
export function addressLabel(branch: ListingBranch): string {
  return [branch.addressLine, branch.barangay?.name, branch.city.name]
    .filter((part) => part !== undefined && part !== '')
    .join(', ');
}

export const isClosedForGood = (status: { listingStatus: string }) =>
  status.listingStatus === 'permanently_closed';

/**
 * An image from the listing, if next/image may load it (under PHOTOS_URL, ARCHITECTURE D43).
 * Render listing images only through this.
 */
export function shownImage(image: ListingImage | null | undefined): ListingImage | null {
  return allowedPhoto(image, serverEnv().PHOTOS_URL);
}

/** The branch's photos that can be shown, in order. */
export function shownPhotos(branch: ListingBranch): ListingImage[] {
  return branch.photos.flatMap((photo) => shownImage(photo) ?? []);
}

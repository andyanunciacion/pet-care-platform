import type { Metadata } from 'next';
import { brand } from './brand';
import type { ListingImage } from './public-types';

/**
 * A listing page's metadata (ARCHITECTURE §8): its title and description, the canonical URL
 * (relative; the root layout's `metadataBase` makes it absolute on SITE_URL), and the Open
 * Graph tags Facebook and Messenger read when a link is shared (PRD: links will be shared a
 * lot). A page's `openGraph` replaces the layout's whole object, so it's built completely
 * here. Permanently closed listings stay readable but aren't indexed.
 */
export function listingMetadata({
  title,
  description,
  path,
  image,
  closedForGood,
}: {
  title: string;
  description: string;
  path: string;
  /** The preview image: the branch's first photo, else the logo (P1-6 adds a default). */
  image: ListingImage | null;
  closedForGood: boolean;
}): Metadata {
  const images =
    image === null
      ? []
      : [{ url: image.url, width: image.width, height: image.height, alt: image.alt }];
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      type: 'website',
      url: path,
      title,
      description,
      siteName: brand.name,
      locale: 'en_PH',
      images,
    },
    twitter: {
      card: image === null ? 'summary' : 'summary_large_image',
      title,
      description,
      images: images.map(({ url, alt }) => ({ url, alt })),
    },
    ...(closedForGood && { robots: { index: false, follow: true } }),
  };
}

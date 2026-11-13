import type {
  LocalBusinessLeaf,
  OpeningHoursSpecification,
  Organization,
  WithContext,
} from 'schema-dts';
import type { Listing, ListingBranch, ListingBusiness, ListingImage } from './public-types';

// Structured data for listing pages (ARCHITECTURE §8): what search engines read to show a
// clinic's hours, address and map pin. Built from the same data as the page and, like the
// page's HTML, only says what stays true however old the cached page is (DESIGN UX20): no
// open status, only the weekly hours and dated exceptions.

/** The schema.org type per business type (ARCHITECTURE §5.3). A new business type must pick one. */
const SCHEMA_TYPE = {
  vet_clinic: 'VeterinaryCare',
} as const satisfies Record<ListingBusiness['type'], string>;

/**
 * A branch is typed as both its own type and `LocalBusiness`. schema.org files
 * `VeterinaryCare` under MedicalOrganization, not LocalBusiness, so alone it has no map pin
 * (`geo`) or opening hours; with `LocalBusiness` it has both, which is what search engines
 * read for a place. The properties are type-checked against LocalBusiness.
 */
type BranchJsonLd = Omit<LocalBusinessLeaf, '@type'> & {
  '@context': 'https://schema.org';
  '@type': [(typeof SCHEMA_TYPE)[ListingBusiness['type']], 'LocalBusiness'];
};

/** ISO weekday (1 = Monday … 7 = Sunday, as `dayOfWeek` in the API) → schema.org day. */
const DAYS = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
] as const;

const dayName = (isoWeekday: number) => DAYS[isoWeekday - 1] ?? 'Monday';

/**
 * The weekly hours, one entry per distinct interval with every day it applies to. An
 * overnight interval keeps its closing time after midnight ("opens 20:00, closes 02:00"),
 * as Google's guidelines ask; open 24 hours is 00:00–23:59 every day.
 */
export function openingHours(branch: ListingBranch): OpeningHoursSpecification[] {
  if (branch.is24h) {
    return [
      {
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: [...DAYS],
        opens: '00:00',
        closes: '23:59',
      },
    ];
  }
  const byInterval = new Map<string, { opens: string; closes: string; days: number[] }>();
  for (const { dayOfWeek, opensAt, closesAt } of branch.weekly) {
    const key = `${opensAt}-${closesAt}`;
    const entry = byInterval.get(key) ?? { opens: opensAt, closes: closesAt, days: [] };
    if (!entry.days.includes(dayOfWeek)) entry.days.push(dayOfWeek);
    byInterval.set(key, entry);
  }
  return [...byInterval.values()]
    .sort((a, b) => a.opens.localeCompare(b.opens) || Math.min(...a.days) - Math.min(...b.days))
    .map(({ opens, closes, days }) => ({
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: days.sort((a, b) => a - b).map(dayName),
      opens,
      closes,
    }));
}

/** Dated exceptions (holidays, special hours). A closed day is 00:00–00:00, per Google. */
export function specialHours(branch: ListingBranch): OpeningHoursSpecification[] {
  return branch.exceptions.flatMap(({ date, isClosed, intervals }) =>
    isClosed || intervals.length === 0
      ? [
          {
            '@type': 'OpeningHoursSpecification' as const,
            validFrom: date,
            validThrough: date,
            opens: '00:00',
            closes: '00:00',
          },
        ]
      : intervals.map(({ opensAt, closesAt }) => ({
          '@type': 'OpeningHoursSpecification' as const,
          validFrom: date,
          validThrough: date,
          opens: opensAt,
          closes: closesAt,
        })),
  );
}

const organizationId = (siteUrl: string, business: ListingBusiness) =>
  `${siteUrl}${business.path}#organization`;
const branchId = (siteUrl: string, branch: ListingBranch) => `${siteUrl}${branch.path}#business`;

/** One branch's page: the clinic as a place, with its address, map pin, contacts and hours. */
export function branchJsonLd({
  listing,
  branch,
  siteUrl,
  photos,
  logo,
}: {
  listing: Listing;
  branch: ListingBranch;
  siteUrl: string;
  /** The photos the page shows (already checked with `shownImage`). */
  photos: ListingImage[];
  logo: ListingImage | null;
}): BranchJsonLd {
  const { business } = listing;
  const several = listing.branches.length > 1;
  const contact = (type: ListingBranch['contacts'][number]['type']) =>
    branch.contacts.find((c) => c.type === type)?.value;
  const telephone = contact('phone');
  const email = contact('email');
  const weekly = openingHours(branch);
  const special = specialHours(branch);
  const images = photos.length > 0 ? photos : logo === null ? [] : [logo];
  const street = [branch.addressLine, branch.barangay?.name].filter(
    (part): part is string => part !== undefined && part !== '',
  );

  return {
    '@context': 'https://schema.org',
    '@type': [SCHEMA_TYPE[business.type], 'LocalBusiness'],
    '@id': branchId(siteUrl, branch),
    name: several ? `${business.name} – ${branch.name}` : business.name,
    url: `${siteUrl}${branch.path}`,
    ...(business.description !== null && { description: business.description }),
    ...(images.length > 0 && { image: images.map((image) => image.url) }),
    ...(logo !== null && { logo: logo.url }),
    ...(telephone !== undefined && { telephone }),
    ...(email !== undefined && { email }),
    address: {
      '@type': 'PostalAddress',
      ...(street.length > 0 && { streetAddress: street.join(', ') }),
      addressLocality: branch.city.name,
      addressRegion: branch.province.name,
      addressCountry: 'PH',
    },
    geo: {
      '@type': 'GeoCoordinates',
      latitude: branch.location.lat,
      longitude: branch.location.lng,
    },
    ...(weekly.length > 0 && { openingHoursSpecification: weekly }),
    ...(special.length > 0 && { specialOpeningHoursSpecification: special }),
    ...(several && {
      parentOrganization: {
        '@type': 'Organization',
        '@id': organizationId(siteUrl, business),
        name: business.name,
        url: `${siteUrl}${business.path}`,
      },
    }),
  };
}

/** A business with several branches (its list page): the brand, pointing at each branch. */
export function businessJsonLd({
  listing,
  siteUrl,
  logo,
}: {
  listing: Listing;
  siteUrl: string;
  logo: ListingImage | null;
}): WithContext<Organization> {
  const { business, branches } = listing;
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': organizationId(siteUrl, business),
    name: business.name,
    url: `${siteUrl}${business.path}`,
    ...(business.description !== null && { description: business.description }),
    ...(logo !== null && { logo: logo.url }),
    subOrganization: branches.map((branch) => ({
      '@type': SCHEMA_TYPE[business.type],
      '@id': branchId(siteUrl, branch),
      name: `${business.name} – ${branch.name}`,
      url: `${siteUrl}${branch.path}`,
    })),
  };
}

/**
 * The JSON for a `<script type="application/ld+json">`. `<` is escaped so text from the
 * listing (a name with "</script>") can't end the script tag early (Next's JSON-LD guide).
 */
export function jsonLdScript(data: object): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}

import { describe, expect, it } from 'vitest';
import { branchJsonLd, businessJsonLd, jsonLdScript, openingHours, specialHours } from './json-ld';
import type { Listing, ListingBranch } from './public-types';

const SITE = 'https://paw.example.test';

function branch(overrides: Partial<ListingBranch> = {}): ListingBranch {
  return {
    id: '0190a1b2-0000-7000-8000-000000000001',
    slug: 'balibago',
    name: 'Balibago',
    path: '/pampanga/angeles-city/happy-paws',
    addressLine: '12 Rizal St.',
    barangay: { name: 'Balibago' },
    city: { name: 'Angeles City', slug: 'angeles-city' },
    province: { name: 'Pampanga', slug: 'pampanga' },
    location: { lng: 120.5887, lat: 15.145 },
    is24h: false,
    acceptsEmergencies: false,
    listingStatus: 'published',
    hoursConfirmedAt: null,
    hoursConfirmedBy: null,
    weekly: [],
    exceptions: [],
    contacts: [],
    species: [],
    services: [],
    photos: [],
    ...overrides,
  };
}

function listing(branches: ListingBranch[]): Listing {
  return {
    business: {
      id: '0190a1b2-0000-7000-8000-0000000000aa',
      slug: 'happy-paws',
      name: 'Happy Paws Vet',
      type: 'vet_clinic',
      description: null,
      claimStatus: 'unclaimed',
      listingStatus: 'published',
      path: '/pampanga/angeles-city/happy-paws',
      logo: null,
      products: [],
    },
    branches,
  };
}

const photo = (name: string) => ({
  url: `https://photos.test/${name}.webp`,
  alt: name,
  width: 1600,
  height: 1200,
});

describe('openingHours', () => {
  it('groups days that share an interval, lunch breaks as two entries', () => {
    const weekdays = [1, 2, 3, 4, 5];
    const hours = openingHours(
      branch({
        weekly: [
          ...weekdays.flatMap((dayOfWeek) => [
            { dayOfWeek, opensAt: '08:00', closesAt: '12:00' },
            { dayOfWeek, opensAt: '13:00', closesAt: '17:00' },
          ]),
          { dayOfWeek: 6, opensAt: '08:00', closesAt: '12:00' },
        ],
      }),
    );
    expect(hours).toEqual([
      {
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
        opens: '08:00',
        closes: '12:00',
      },
      {
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
        opens: '13:00',
        closes: '17:00',
      },
    ]);
  });

  it('keeps an overnight closing time after midnight', () => {
    expect(
      openingHours(branch({ weekly: [{ dayOfWeek: 7, opensAt: '20:00', closesAt: '02:00' }] })),
    ).toEqual([
      {
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: ['Sunday'],
        opens: '20:00',
        closes: '02:00',
      },
    ]);
  });

  it('writes open 24 hours as 00:00–23:59 every day', () => {
    const [spec] = openingHours(branch({ is24h: true }));
    expect(spec).toMatchObject({ opens: '00:00', closes: '23:59' });
    expect(spec?.dayOfWeek).toHaveLength(7);
  });

  it('is empty without hours data', () => {
    expect(openingHours(branch())).toEqual([]);
  });
});

describe('specialHours', () => {
  it('writes closed days as 00:00–00:00 and special hours per interval', () => {
    expect(
      specialHours(
        branch({
          exceptions: [
            { date: '2026-12-25', isClosed: true, intervals: [], note: 'Christmas' },
            {
              date: '2026-12-24',
              isClosed: false,
              intervals: [{ opensAt: '08:00', closesAt: '12:00' }],
              note: null,
            },
          ],
        }),
      ),
    ).toEqual([
      {
        '@type': 'OpeningHoursSpecification',
        validFrom: '2026-12-25',
        validThrough: '2026-12-25',
        opens: '00:00',
        closes: '00:00',
      },
      {
        '@type': 'OpeningHoursSpecification',
        validFrom: '2026-12-24',
        validThrough: '2026-12-24',
        opens: '08:00',
        closes: '12:00',
      },
    ]);
  });
});

describe('branchJsonLd', () => {
  it('describes a single-branch clinic', () => {
    const only = branch({
      contacts: [
        { type: 'viber', value: '+639171234567', label: null },
        { type: 'phone', value: '+639181234567', label: null },
      ],
      weekly: [{ dayOfWeek: 1, opensAt: '08:00', closesAt: '17:00' }],
    });
    const data = branchJsonLd({
      listing: listing([only]),
      branch: only,
      siteUrl: SITE,
      photos: [photo('front'), photo('inside')],
      logo: photo('logo'),
    });
    expect(data).toEqual({
      '@context': 'https://schema.org',
      '@type': ['VeterinaryCare', 'LocalBusiness'],
      '@id': `${SITE}/pampanga/angeles-city/happy-paws#business`,
      name: 'Happy Paws Vet',
      url: `${SITE}/pampanga/angeles-city/happy-paws`,
      image: ['https://photos.test/front.webp', 'https://photos.test/inside.webp'],
      logo: 'https://photos.test/logo.webp',
      telephone: '+639181234567',
      address: {
        '@type': 'PostalAddress',
        streetAddress: '12 Rizal St., Balibago',
        addressLocality: 'Angeles City',
        addressRegion: 'Pampanga',
        addressCountry: 'PH',
      },
      geo: { '@type': 'GeoCoordinates', latitude: 15.145, longitude: 120.5887 },
      openingHoursSpecification: [
        {
          '@type': 'OpeningHoursSpecification',
          dayOfWeek: ['Monday'],
          opens: '08:00',
          closes: '17:00',
        },
      ],
    });
  });

  it('names the branch and points at the business when there are several', () => {
    const first = branch({ path: '/pampanga/angeles-city/happy-paws/balibago' });
    const second = branch({
      id: '0190a1b2-0000-7000-8000-000000000002',
      name: 'Porac',
      path: '/pampanga/porac/happy-paws/porac',
    });
    const data = branchJsonLd({
      listing: listing([first, second]),
      branch: second,
      siteUrl: SITE,
      photos: [],
      logo: photo('logo'),
    });
    expect(data).toMatchObject({
      name: 'Happy Paws Vet – Porac',
      url: `${SITE}/pampanga/porac/happy-paws/porac`,
      // No photos: the logo stands in.
      image: ['https://photos.test/logo.webp'],
      parentOrganization: {
        '@type': 'Organization',
        '@id': `${SITE}/pampanga/angeles-city/happy-paws#organization`,
      },
    });
    expect(data).not.toHaveProperty('openingHoursSpecification');
  });
});

describe('businessJsonLd', () => {
  it('lists each branch of the business', () => {
    const first = branch({ path: '/pampanga/angeles-city/happy-paws/balibago' });
    const second = branch({ name: 'Porac', path: '/pampanga/porac/happy-paws/porac' });
    expect(
      businessJsonLd({ listing: listing([first, second]), siteUrl: SITE, logo: null }),
    ).toEqual({
      '@context': 'https://schema.org',
      '@type': 'Organization',
      '@id': `${SITE}/pampanga/angeles-city/happy-paws#organization`,
      name: 'Happy Paws Vet',
      url: `${SITE}/pampanga/angeles-city/happy-paws`,
      subOrganization: [
        {
          '@type': 'VeterinaryCare',
          '@id': `${SITE}/pampanga/angeles-city/happy-paws/balibago#business`,
          name: 'Happy Paws Vet – Balibago',
          url: `${SITE}/pampanga/angeles-city/happy-paws/balibago`,
        },
        {
          '@type': 'VeterinaryCare',
          '@id': `${SITE}/pampanga/porac/happy-paws/porac#business`,
          name: 'Happy Paws Vet – Porac',
          url: `${SITE}/pampanga/porac/happy-paws/porac`,
        },
      ],
    });
  });
});

describe('jsonLdScript', () => {
  it("escapes < so a name can't close the script tag", () => {
    const script = jsonLdScript({ name: 'Bad </script><script>alert(1)</script>' });
    expect(script).not.toContain('<');
    expect(JSON.parse(script)).toEqual({ name: 'Bad </script><script>alert(1)</script>' });
  });
});

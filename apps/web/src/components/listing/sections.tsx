import {
  ChevronRight,
  CircleX,
  Mail,
  MessageCircle,
  PawPrint,
  Phone,
  Smartphone,
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';
import { outlineAction, primaryAction } from '@/lib/action-styles';
import {
  contactReach,
  mailLink,
  phoneLabel,
  telLink,
  viberLink,
  type ContactReach,
} from '@/lib/contact-links';
import { addressLabel, branchHours, isClosedForGood, shownImage } from '@/lib/listing';
import { servicePriceLabel } from '@/lib/price-format';
import { priceLabels } from '@/lib/price-labels';
import type {
  ListingBranch,
  ListingBusiness,
  ListingContact,
  ListingProduct,
  ListingService,
} from '@/lib/public-types';
import { cn } from '@/lib/utils';
import { DirectionsAppLink } from './directions';
import { EmergencyLine, LiveStatus } from './live-status';

// The parts of the clinic page (DESIGN UX8). Server Components; the time-dependent pieces
// inside them (status, hours table) are small Client Components.

export function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-3">
      <h2 id={id} className="text-xl font-bold tracking-tight">
        {title}
      </h2>
      {children}
    </section>
  );
}

/**
 * The business's logo beside its name in the page header, when it has one. Fixed size, so
 * the header doesn't shift when it loads; `object-contain` fits logos of any shape. The alt
 * is empty on purpose: the name right next to it already says it, and a screen reader
 * would read it twice.
 */
export function BusinessLogo({ business }: { business: ListingBusiness }) {
  const logo = shownImage(business.logo);
  if (logo === null) return null;
  return (
    <Image
      src={logo.url}
      alt=""
      width={56}
      height={56}
      // In the header, so above the fold: load it right away (it's small, not the LCP).
      loading="eager"
      className="size-14 shrink-0 rounded-lg border bg-background object-contain"
    />
  );
}

/** "Permanently closed" in place of the open status. */
export async function ClosedNotice({ detail }: { detail: string }) {
  const t = await getTranslations('Listing');
  return (
    <div role="status" className="flex flex-col gap-1 rounded-xl bg-muted p-4">
      <p className="flex items-center gap-1.5 font-semibold text-status-closed">
        <CircleX aria-hidden className="size-5 shrink-0" />
        {t('permanentlyClosed')}
      </p>
      <p>{detail}</p>
    </div>
  );
}

/**
 * "Takes emergencies" / "Closed now · call for emergencies" (DESIGN UX19), for branches that
 * do. Nothing without a phone number: the flag promises a call, which owners can't make.
 */
export async function Emergencies({ branch }: { branch: ListingBranch }) {
  if (contactReach(branch.contacts) !== 'call') return null;
  const t = await getTranslations('Listing');
  return (
    <EmergencyLine
      hours={branchHours(branch)}
      labels={{
        anytime: t('emergencies'),
        open: t('emergenciesOpen'),
        closed: t('emergenciesClosed'),
        unknown: t('emergenciesUnknown'),
      }}
    />
  );
}

export async function AddressSection({ branch }: { branch: ListingBranch }) {
  const t = await getTranslations('Listing');
  return (
    <Section id="address" title={t('addressTitle')}>
      <p className="text-pretty">{addressLabel(branch)}</p>
      <p className="flex gap-4">
        <DirectionsAppLink app="google_maps" location={branch.location}>
          {t('openInGoogleMaps')}
        </DirectionsAppLink>
        <DirectionsAppLink app="waze" location={branch.location}>
          {t('openInWaze')}
        </DirectionsAppLink>
      </p>
    </Section>
  );
}

const CONTACT_ICON = {
  phone: Phone,
  viber: Smartphone,
  messenger: MessageCircle,
  email: Mail,
} as const;

export async function ContactSection({ branch }: { branch: ListingBranch }) {
  const t = await getTranslations('Listing');
  const typeLabel: Record<ListingContact['type'], string> = {
    phone: t('phone'),
    viber: t('viber'),
    messenger: t('messenger'),
    email: t('email'),
  };
  const link = (contact: ListingContact) => {
    switch (contact.type) {
      case 'phone':
        return { href: telLink(contact.value), text: phoneLabel(contact.value) };
      case 'viber':
        return { href: viberLink(contact.value), text: phoneLabel(contact.value) };
      case 'messenger':
        return { href: contact.value, text: contact.label ?? t('messengerLink') };
      case 'email':
        return { href: mailLink(contact.value), text: contact.value };
    }
  };

  return (
    <Section id="contact" title={t('contactTitle')}>
      {branch.contacts.length === 0 ? (
        <p className="text-muted-foreground">{t('noContacts')}</p>
      ) : (
        <ul className="flex flex-col">
          {branch.contacts.map((contact) => {
            const Icon = CONTACT_ICON[contact.type];
            const { href, text } = link(contact);
            const external = contact.type === 'messenger';
            return (
              <li key={`${contact.type}:${contact.value}`}>
                <a
                  href={href}
                  {...(external && { target: '_blank', rel: 'noopener noreferrer' })}
                  className="flex min-h-12 items-center gap-3 rounded-md hover:bg-muted"
                >
                  <Icon aria-hidden className="size-5 shrink-0 text-primary" />
                  <span className="flex flex-col">
                    <span className="font-medium text-primary underline underline-offset-4">
                      {text}
                    </span>
                    {/* Read as "0917 123 4567, Phone", not run together. */}
                    <span className="sr-only">, </span>
                    <span className="text-sm text-muted-foreground">
                      {typeLabel[contact.type]}
                      {contact.label !== null &&
                        contact.type !== 'messenger' &&
                        ` · ${contact.label}`}
                    </span>
                  </span>
                </a>
              </li>
            );
          })}
        </ul>
      )}
    </Section>
  );
}

/** Services grouped by category group ("Surgery"), each with its price (DESIGN UX10). */
export async function ServicesSection({
  services,
  reach,
}: {
  services: ListingService[];
  /** Without a phone, "Call for price" and "Call the clinic" become ask/message (UX17). */
  reach: ContactReach;
}) {
  const t = await getTranslations('Listing');
  const tPrices = await getTranslations('Prices');
  const allLabels = priceLabels(tPrices);
  const labels =
    reach === 'call' ? allLabels : { ...allLabels, callForPrice: tPrices('askForPrice') };
  const noServices = {
    call: t('noServices'),
    message: t('noServicesMessage'),
    visit: t('noServicesVisit'),
  }[reach];

  const groups = new Map<string, ListingService[]>();
  for (const service of services) {
    const group = service.category.groupName ?? service.category.name;
    groups.set(group, [...(groups.get(group) ?? []), service]);
  }

  return (
    <Section id="services" title={t('servicesTitle')}>
      {services.length === 0 ? (
        <p className="text-muted-foreground">{noServices}</p>
      ) : (
        <>
          {[...groups].map(([group, items]) => (
            <div key={group} className="flex flex-col gap-1">
              {/* Foreground text on the muted band (the White-Under-Status rule, DESIGN §7.1). */}
              <h3 className="rounded-lg bg-muted px-3 py-1.5 font-semibold">{group}</h3>
              <ul className="flex flex-col divide-y">
                {items.map((service) => (
                  <li key={service.id} className="flex flex-col gap-0.5 py-3">
                    {/*
                      The name keeps at least 12rem; a price too long to fit beside it (a
                      range with a unit) moves to its own line, still right-aligned.
                    */}
                    <div className="flex flex-wrap items-baseline gap-x-4">
                      <span className="min-w-[min(100%,12rem)] flex-1 font-medium text-pretty">
                        {service.name}
                      </span>
                      <span className="ml-auto shrink-0 text-right font-semibold">
                        {servicePriceLabel(service, labels)}
                      </span>
                    </div>
                    {service.priceNote !== null && (
                      <p className="text-sm text-muted-foreground">{service.priceNote}</p>
                    )}
                    {service.species.length > 0 && (
                      <p className="text-sm text-muted-foreground">
                        {t('forSpecies', { species: service.species.join(', ') })}
                      </p>
                    )}
                    {service.description !== null && (
                      <p className="text-sm">{service.description}</p>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
          <p className="text-sm text-muted-foreground">{t('pricesFootnote')}</p>
        </>
      )}
    </Section>
  );
}

/**
 * The business's products, read-only (PRD: name, photo, price, availability; no cart), right
 * after the services (DESIGN UX8). Availability is always written out, never only shown by
 * color. A thumbnail only when the product has an image: no placeholder.
 */
export async function ProductsSection({
  products,
  reach,
}: {
  products: ListingProduct[];
  reach: ContactReach;
}) {
  if (products.length === 0) return null;
  const t = await getTranslations('Listing');
  const labels = priceLabels(await getTranslations('Prices'));
  // When some products have a thumbnail, the others keep the same text column.
  const anyImage = products.some((product) => shownImage(product.image) !== null);
  return (
    <Section id="products" title={t('productsTitle')}>
      <ul className="flex flex-col divide-y">
        {products.map((product) => {
          const image = shownImage(product.image);
          return (
            <li key={product.id} className="flex items-center gap-3 py-3">
              {image === null ? (
                anyImage && <div aria-hidden className="size-16 shrink-0" />
              ) : (
                <Image
                  src={image.url}
                  alt={image.alt}
                  width={64}
                  height={64}
                  className="size-16 shrink-0 rounded-lg bg-muted object-cover"
                />
              )}
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <div className="flex flex-wrap items-baseline gap-x-4">
                  <span className="min-w-[min(100%,12rem)] flex-1 font-medium text-pretty">
                    {product.name}
                  </span>
                  <span className="ml-auto shrink-0 text-right font-semibold">
                    {labels.productPrice(product.price)}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">
                  {[product.category, t(`availability.${product.availability}`)]
                    .filter((part) => part !== null)
                    .join(' · ')}
                </p>
              </div>
            </li>
          );
        })}
      </ul>
      <p className="text-sm text-muted-foreground">
        {
          {
            call: t('productsFootnote'),
            message: t('productsFootnoteMessage'),
            visit: t('productsFootnoteVisit'),
          }[reach]
        }
      </p>
    </Section>
  );
}

/**
 * "Treats" followed by a pill per animal, near the top of the page and on branch cards
 * (DESIGN UX8): whether a clinic sees your animal decides whether anything else on the page
 * matters. `compact` is the smaller version for branch cards.
 */
export async function SpeciesLine({
  species,
  compact = false,
}: {
  species: ListingBranch['species'];
  compact?: boolean;
}) {
  if (species.length === 0) return null;
  const t = await getTranslations('Listing');
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
      <span className="flex items-center gap-1.5 font-medium">
        <PawPrint aria-hidden className="size-5 shrink-0 text-muted-foreground" />
        {t('treats')}
      </span>
      <ul aria-label={t('treatsLabel')} className="flex flex-wrap gap-1.5">
        {species.map((item) => (
          <li
            key={item.code}
            className={
              compact
                ? 'rounded-full bg-muted px-2.5 py-0.5 text-sm font-medium'
                : 'rounded-full bg-muted px-3 py-1 font-medium'
            }
          >
            {item.name}
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * One branch as a card: name, area, live status (or closed), then its actions at the bottom
 * (lined up across cards): an optional **Call** and **View branch**. Only the buttons are
 * tappable; the card's border turns teal on hover to show which branch they belong to.
 */
export async function BranchSummary({
  branch,
  renderedAt,
  showCall = false,
}: {
  branch: ListingBranch;
  renderedAt: string;
  /** Adds a Call button when the branch is open for business and has a phone number. */
  showCall?: boolean;
}) {
  const t = await getTranslations('Listing');
  const phone = branch.contacts.find((contact) => contact.type === 'phone');
  const callable = showCall && !isClosedForGood(branch) && phone !== undefined;

  return (
    <li className="flex flex-col gap-2 rounded-xl border p-4 transition-colors hover:border-primary motion-reduce:transition-none">
      <h3 className="text-lg font-semibold">{branch.name}</h3>
      <p className="text-pretty text-muted-foreground">{addressLabel(branch)}</p>
      <SpeciesLine species={branch.species} compact />
      {isClosedForGood(branch) ? (
        <p className="flex items-center gap-1.5 font-semibold text-status-closed">
          <CircleX aria-hidden className="size-5 shrink-0" />
          {t('permanentlyClosed')}
        </p>
      ) : (
        <>
          <LiveStatus
            hours={branchHours(branch)}
            renderedAt={renderedAt}
            reach={contactReach(branch.contacts)}
          />
          {branch.acceptsEmergencies && <Emergencies branch={branch} />}
        </>
      )}
      <div className="mt-auto flex gap-2 pt-2">
        {callable && (
          <a href={telLink(phone.value)} className={cn(primaryAction, 'flex-1')}>
            <Phone aria-hidden className="size-5" />
            {t('call')}
            <span className="sr-only">{` ${branch.name}`}</span>
          </a>
        )}
        <Link href={branch.path} className={cn(outlineAction, 'flex-1')}>
          {t('viewBranch')}
          <span className="sr-only">{` ${branch.name}`}</span>
          <ChevronRight aria-hidden className="size-5" />
        </Link>
      </div>
    </li>
  );
}

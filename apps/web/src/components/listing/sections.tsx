import {
  ChevronRight,
  CircleX,
  Mail,
  MessageCircle,
  PawPrint,
  Phone,
  Smartphone,
} from 'lucide-react';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';
import { outlineAction, primaryAction } from '@/lib/action-styles';
import { mailLink, phoneLabel, telLink, viberLink } from '@/lib/contact-links';
import { addressLabel, branchHours, isClosedForGood } from '@/lib/listing';
import { servicePriceLabel } from '@/lib/price-format';
import { priceLabels } from '@/lib/price-labels';
import type { ListingBranch, ListingContact, ListingService } from '@/lib/public-types';
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

/** "Takes emergencies" / "Closed now · call for emergencies" (DESIGN UX19), for branches that do. */
export async function Emergencies({ branch }: { branch: ListingBranch }) {
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
      <p>{addressLabel(branch)}</p>
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
export async function ServicesSection({ services }: { services: ListingService[] }) {
  const t = await getTranslations('Listing');
  const labels = priceLabels(await getTranslations('Prices'));

  const groups = new Map<string, ListingService[]>();
  for (const service of services) {
    const group = service.category.groupName ?? service.category.name;
    groups.set(group, [...(groups.get(group) ?? []), service]);
  }

  return (
    <Section id="services" title={t('servicesTitle')}>
      {services.length === 0 ? (
        <p className="text-muted-foreground">{t('noServices')}</p>
      ) : (
        <>
          {[...groups].map(([group, items]) => (
            <div key={group} className="flex flex-col gap-1">
              <h3 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
                {group}
              </h3>
              <ul className="flex flex-col divide-y">
                {items.map((service) => (
                  <li key={service.id} className="flex flex-col gap-0.5 py-3">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-4">
                      <span className="font-medium">{service.name}</span>
                      <span className="font-semibold">{servicePriceLabel(service, labels)}</span>
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
          <LiveStatus hours={branchHours(branch)} renderedAt={renderedAt} />
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

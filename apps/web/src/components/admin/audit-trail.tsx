import Link from 'next/link';
import { getFormatter, getLocale, getTranslations } from 'next-intl/server';
import {
  CLAIM_STATUSES,
  CONTACT_TYPES,
  HOURS_CONFIRMED_BY,
  LISTING_STATUSES,
  PRODUCT_AVAILABILITIES,
  type AuditEntry,
} from '@/lib/admin-types';
import { auditValueLines, type AuditValueLabels } from '@/lib/audit-format';
import { weekdayLabel } from '@/lib/hours-format';
import { servicePriceLabel } from '@/lib/price-format';
import { priceLabels } from '@/lib/price-labels';

// Labels exist for these; anything newer is shown as stored (e.g. "claim.approve").
const ACTIONS = [
  'business.create',
  'business.update',
  'business.create_product',
  'business.update_product',
  'business.delete_product',
  'business.set_logo',
  'business.update_logo',
  'business.delete_logo',
  'business.set_product_image',
  'business.update_product_image',
  'business.delete_product_image',
  'branch.create',
  'branch.update',
  'branch.update_hours',
  'branch.set_hours_exception',
  'branch.delete_hours_exception',
  'branch.confirm_hours',
  'branch.update_species',
  'branch.create_service',
  'branch.update_service',
  'branch.delete_service',
  'branch.copy_service',
  'branch.add_photo',
  'branch.update_photo',
  'branch.delete_photo',
  'branch.reorder_photos',
  'user.set_platform_role',
] as const;
const FIELDS = [
  'name',
  'slug',
  'type',
  'description',
  'dataSource',
  'claimStatus',
  'listingStatus',
  'businessId',
  'addressLine',
  'provinceCode',
  'cityCode',
  'barangayCode',
  'location',
  'is24h',
  'acceptsEmergencies',
  'contacts',
  'weeklyHours',
  'hoursException',
  'hoursConfirmedAt',
  'hoursConfirmedBy',
  'speciesTreated',
  'service',
  'product',
  'photo',
  'photoOrder',
  'logo',
  'productImage',
  'platformRole',
] as const;

function isOneOf<T extends string>(list: readonly T[], value: string): value is T {
  return (list as readonly string[]).includes(value);
}

function fieldOrder(field: string): number {
  const index = (FIELDS as readonly string[]).indexOf(field);
  return index === -1 ? FIELDS.length : index;
}

/** Where an entry's record is edited, if the admin has a page for it. */
function entityHref(entry: AuditEntry): string | undefined {
  if (entry.entityType === 'business') return `/admin/businesses/${entry.entityId}`;
  if (entry.entityType === 'branch') return `/admin/branches/${entry.entityId}`;
  return undefined;
}

/** A list of audit entries with their field-by-field changes. */
export async function AuditTrail({ entries }: { entries: AuditEntry[] }) {
  const [t, tEnums, tPrices, format, locale] = await Promise.all([
    getTranslations('AdminAudit'),
    getTranslations('Enums'),
    getTranslations('Prices'),
    getFormatter(),
    getLocale(),
  ]);
  const prices = priceLabels(tPrices);

  if (entries.length === 0) {
    return (
      <p className="rounded-lg border border-dashed p-6 text-muted-foreground">{t('empty')}</p>
    );
  }

  const labelsFor = (field: string): AuditValueLabels => ({
    none: t('noValue'),
    yes: t('yes'),
    no: t('no'),
    closed: t('closed'),
    contactType: (type) =>
      isOneOf(CONTACT_TYPES, type) ? tEnums(`contactType.${type}`) : undefined,
    weekday: (day) => weekdayLabel(day, locale, 'short'),
    dateTime: (iso) => format.dateTime(new Date(iso), { dateStyle: 'medium', timeStyle: 'short' }),
    enumValue: (value) => {
      if (field === 'hoursConfirmedBy' && isOneOf(HOURS_CONFIRMED_BY, value)) {
        return tEnums(`hoursConfirmedBy.${value}`);
      }
      if (field === 'listingStatus' && isOneOf(LISTING_STATUSES, value)) {
        return tEnums(`listingStatus.${value}`);
      }
      if (field === 'claimStatus' && isOneOf(CLAIM_STATUSES, value)) {
        return tEnums(`claimStatus.${value}`);
      }
      if (field === 'type' && value === 'vet_clinic') return tEnums('businessType.vet_clinic');
      if (field === 'product' && isOneOf(PRODUCT_AVAILABILITIES, value)) {
        return tEnums(`productAvailability.${value}`);
      }
      return undefined;
    },
    servicePrice: (price) => servicePriceLabel(price, prices),
    productPrice: prices.productPrice,
  });

  return (
    <ol className="flex flex-col divide-y rounded-lg border">
      {entries.map((entry) => {
        const href = entityHref(entry);
        // jsonb doesn't keep key order, so list fields in form order (unknown ones last).
        const changes = Object.entries(entry.diff ?? {}).sort(
          ([a], [b]) => fieldOrder(a) - fieldOrder(b),
        );
        return (
          <li key={entry.id} className="flex flex-col gap-3 p-4">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm">
              <span className="font-medium">
                {isOneOf(ACTIONS, entry.action) ? t(`actions.${entry.action}`) : entry.action}
              </span>
              <span className="text-muted-foreground">
                {t('by', { actor: entry.actor?.email ?? t('script') })}
              </span>
              <time dateTime={entry.createdAt} className="text-muted-foreground">
                {format.dateTime(new Date(entry.createdAt), {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                })}
              </time>
              {href !== undefined && (
                <Link href={href} className="text-primary hover:underline">
                  {t('open')}
                </Link>
              )}
            </div>
            {changes.length > 0 && (
              <table className="w-full text-sm">
                <caption className="sr-only">{t('change')}</caption>
                <thead className="text-left text-muted-foreground">
                  <tr>
                    <th scope="col" className="w-1/5 py-1 pr-4 font-normal">
                      {t('field')}
                    </th>
                    <th scope="col" className="w-2/5 py-1 pr-4 font-normal">
                      {t('from')}
                    </th>
                    <th scope="col" className="w-2/5 py-1 font-normal">
                      {t('to')}
                    </th>
                  </tr>
                </thead>
                <tbody className="align-top">
                  {changes.map(([field, { from, to }]) => (
                    <tr key={field} className="border-t">
                      <th scope="row" className="py-1 pr-4 text-left font-medium">
                        {isOneOf(FIELDS, field) ? t(`fields.${field}`) : field}
                      </th>
                      <td className="py-1 pr-4 break-words text-muted-foreground">
                        {auditValueLines(from, labelsFor(field)).map((line, i) => (
                          <div key={i}>{line}</div>
                        ))}
                      </td>
                      <td className="py-1 break-words">
                        {auditValueLines(to, labelsFor(field)).map((line, i) => (
                          <div key={i}>{line}</div>
                        ))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </li>
        );
      })}
    </ol>
  );
}

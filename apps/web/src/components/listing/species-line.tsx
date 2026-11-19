import { PawPrint } from 'lucide-react';
import { useTranslations } from 'next-intl';

/**
 * "Treats" followed by a sticker label per animal (like the vaccine stickers in a pet's
 * booklet), near the top of the clinic page, on branch cards and on search results (DESIGN
 * UX8, UX3): whether a clinic sees your animal decides whether anything else matters.
 * `compact` is the smaller version for cards. Not async, so search result cards (Client
 * Components) can use it too; it needs the Listing messages `treats` and `treatsLabel`.
 */
export function SpeciesLine({
  species,
  compact = false,
}: {
  species: readonly { code: string; name: string }[];
  compact?: boolean;
}) {
  const t = useTranslations('Listing');
  if (species.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
      <span className="flex items-center gap-1.5 font-semibold">
        <PawPrint aria-hidden className="size-5 shrink-0 text-muted-foreground" />
        {t('treats')}
      </span>
      <ul aria-label={t('treatsLabel')} className="flex flex-wrap gap-1.5">
        {species.map((item) => (
          <li
            key={item.code}
            className={
              compact
                ? 'rounded-md border border-b-2 bg-background px-2 py-0.5 text-sm font-semibold'
                : 'rounded-md border border-b-2 bg-background px-3 py-1 font-semibold'
            }
          >
            {item.name}
          </li>
        ))}
      </ul>
    </div>
  );
}

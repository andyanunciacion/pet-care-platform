'use client';

import { LocateFixed } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useTransition } from 'react';
import { outlineAction } from '@/lib/action-styles';
import type { City } from '@/lib/public-types';
import { emergencyHref, type SearchLocation } from '@/lib/search-href';
import { cn } from '@/lib/utils';
import { LocationPicker, useSearchLocation } from './location-picker';

/**
 * The emergency view's location line (DESIGN UX7): no search box, only where. With
 * JavaScript, picking a city or finding the owner's position opens that place's view at
 * once (one tap, no submit). Without it, it's a GET form to /emergency with a button.
 */
export function EmergencyLocation({
  location,
  cities,
  defaultCityCode,
}: {
  location: SearchLocation;
  cities: City[];
  defaultCityCode: string;
}) {
  const t = useTranslations('Emergency');
  const router = useRouter();
  // The next view renders on the server; the status line says so meanwhile (pending.tsx).
  const [pending, startTransition] = useTransition();
  const control = useSearchLocation({
    initial: location,
    defaultCityCode,
    onChosen: (place) => {
      startTransition(() => {
        router.push(emergencyHref(place));
      });
    },
  });

  return (
    <form action="/emergency" className="flex flex-col gap-1">
      {location.kind !== 'near' && (
        // Distance is one of the three things this view is for (principle 7), and it needs
        // the owner's position: one tap away, not behind "Change". Rendered on the server too,
        // so the page doesn't shift; it works once the page's JavaScript has loaded.
        <button
          type="button"
          onClick={() => void control.findMyLocation()}
          disabled={!control.hydrated || control.status === 'locating'}
          className={cn(outlineAction, 'mb-1 self-start px-4 disabled:opacity-70')}
        >
          <LocateFixed aria-hidden className="size-5" />
          {t('nearest')}
        </button>
      )}
      <LocationPicker
        control={control}
        cities={cities}
        failedMessage={t('locationFailed')}
        pendingMessage={pending ? t('loading') : null}
      >
        <button type="submit" className={cn(outlineAction, 'self-start px-4')}>
          {t('showHere')}
        </button>
      </LocationPicker>
    </form>
  );
}

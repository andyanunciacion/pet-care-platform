'use client';

import type { LngLat } from '@paw/domain';
import { Navigation } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRef, type MouseEvent, type ReactNode } from 'react';
import { outlineAction } from '@/lib/action-styles';
import { directionsLink, isDirectionsApp, type DirectionsApp } from '@/lib/contact-links';
import { cn } from '@/lib/utils';

// Directions open Google Maps or Waze: the owner picks once, the browser remembers it
// (DESIGN UX9). Only a convenience: without storage (private mode) they're asked each time,
// and without JavaScript the link opens Google Maps.

const STORAGE_KEY = 'paw.directionsApp';

function savedApp(): DirectionsApp | null {
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    return isDirectionsApp(value) ? value : null;
  } catch {
    return null;
  }
}

function saveApp(app: DirectionsApp): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, app);
  } catch {
    // Storage blocked: they'll be asked again next time.
  }
}

/** The contact bar's Directions button: opens the remembered app, or asks which one. */
export function DirectionsButton({
  location,
  className,
}: {
  location: LngLat;
  className?: string;
}) {
  const t = useTranslations('Directions');
  const dialog = useRef<HTMLDialogElement>(null);

  const onClick = (event: MouseEvent<HTMLAnchorElement>) => {
    const app = savedApp();
    if (app === 'google_maps') return; // the link's own href
    event.preventDefault();
    if (app === 'waze') window.location.assign(directionsLink('waze', location));
    else dialog.current?.showModal();
  };

  return (
    <>
      <a href={directionsLink('google_maps', location)} onClick={onClick} className={className}>
        <Navigation aria-hidden className="size-5" />
        {t('directions')}
      </a>
      <dialog
        ref={dialog}
        aria-labelledby="directions-title"
        className="m-auto w-[min(24rem,calc(100%-2rem))] rounded-xl bg-background p-5 text-foreground shadow-xl backdrop:bg-foreground/40"
      >
        <h2 id="directions-title" className="text-lg font-semibold">
          {t('chooseTitle')}
        </h2>
        <p className="mt-1 text-muted-foreground">{t('chooseHint')}</p>
        <div className="mt-4 flex flex-col gap-2">
          <DirectionsAppLink app="google_maps" location={location} variant="button">
            {t('googleMaps')}
          </DirectionsAppLink>
          <DirectionsAppLink app="waze" location={location} variant="button">
            {t('waze')}
          </DirectionsAppLink>
          <button
            type="button"
            onClick={() => dialog.current?.close()}
            className="min-h-11 rounded-lg px-4 font-medium text-primary transition-colors duration-150 hover:bg-muted active:translate-y-px"
          >
            {t('cancel')}
          </button>
        </div>
      </dialog>
    </>
  );
}

/** A link to one app's directions; following it makes that app the remembered choice. */
export function DirectionsAppLink({
  app,
  location,
  variant = 'text',
  children,
}: {
  app: DirectionsApp;
  location: LngLat;
  variant?: 'text' | 'button';
  children: ReactNode;
}) {
  return (
    <a
      href={directionsLink(app, location)}
      onClick={() => {
        saveApp(app);
      }}
      className={cn(
        variant === 'button'
          ? outlineAction
          : 'inline-flex min-h-11 items-center font-medium text-primary underline underline-offset-4 hover:decoration-2',
      )}
    >
      {children}
    </a>
  );
}

'use client';

import { LoaderCircle, LocateFixed, MapPin } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState, useSyncExternalStore, type ReactNode } from 'react';
import type { City } from '@/lib/public-types';
import type { SearchLocation } from '@/lib/search-href';

// The location line (DESIGN UX1): "In Angeles City · Change", which opens Use my location
// and a city picker. Shared by the search form and the emergency view. Location is asked for
// only when the owner wants "near me"; if it's refused, they pick a city. The browser
// remembers only which kind of location was chosen ("near me", a city, all areas), never
// the position itself (ARCHITECTURE D46).

const STORAGE_KEY = 'paw.searchLocation';

type Point = { lat: number; lng: number; radiusKm?: number };

/** Where the next search goes. "near" without a point asks the browser for it on submit. */
type Mode =
  { kind: 'near'; point: Point | null } | { kind: 'city'; code: string } | { kind: 'all' };

function modeOf(location: SearchLocation): Mode {
  if (location.kind === 'near') {
    const { lat, lng, radiusKm } = location;
    return { kind: 'near', point: { lat, lng, ...(radiusKm !== undefined && { radiusKm }) } };
  }
  return location;
}

/** The place a mode names, or null for "near me" before the position is known. */
function locationOf(mode: Mode): SearchLocation | null {
  if (mode.kind !== 'near') return mode;
  return mode.point === null ? null : { kind: 'near', ...mode.point };
}

/** The remembered choice: "near", "city:0330100000" or "all". */
function readSaved(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function save(mode: Mode): void {
  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      mode.kind === 'city' ? `city:${mode.code}` : mode.kind,
    );
  } catch {
    // Storage blocked (private mode): they choose again next time.
  }
}

function savedMode(saved: string | null): Mode | null {
  if (saved === 'near') return { kind: 'near', point: null };
  if (saved === 'all') return { kind: 'all' };
  const code = saved?.startsWith('city:') === true ? saved.slice(5) : '';
  return /^[0-9]{10}$/.test(code) ? { kind: 'city', code } : null;
}

const subscribeStorage = (onChange: () => void) => {
  window.addEventListener('storage', onChange);
  return () => {
    window.removeEventListener('storage', onChange);
  };
};
const noop = () => () => {};

function locate(): Promise<Point | null> {
  return new Promise((resolve) => {
    if (!('geolocation' in navigator)) {
      resolve(null);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        resolve({ lat: coords.latitude, lng: coords.longitude });
      },
      () => {
        resolve(null);
      },
      // A fix from the last few minutes is close enough, and quicker on a phone.
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 300_000 },
    );
  });
}

/**
 * The location line's state. `onChosen` runs when the owner picks a place (a city, all
 * areas, or their position once found): the emergency view goes there at once.
 */
export function useSearchLocation({
  initial,
  defaultCityCode,
  rememberLocation = false,
  onChosen,
}: {
  initial: SearchLocation;
  defaultCityCode: string;
  /** Start from the owner's remembered kind of location instead of `initial` (home). */
  rememberLocation?: boolean;
  onChosen?: (location: SearchLocation) => void;
}) {
  const hydrated = useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
  const saved = useSyncExternalStore(subscribeStorage, readSaved, () => null);
  const [chosen, setChosen] = useState<Mode | null>(null);
  const [status, setStatus] = useState<'idle' | 'locating' | 'failed'>('idle');
  const [pickerOpen, setPickerOpen] = useState(false);

  const mode: Mode = chosen ?? (rememberLocation ? savedMode(saved) : null) ?? modeOf(initial);

  const choose = (next: Mode) => {
    setChosen(next);
    save(next);
    setStatus('idle');
    const location = locationOf(next);
    if (location !== null) onChosen?.(location);
  };

  /** "Near me" failed or was refused: say so, and let them pick a city instead. */
  const locationFailed = () => {
    setChosen({ kind: 'city', code: defaultCityCode });
    save({ kind: 'city', code: defaultCityCode });
    setStatus('failed');
    setPickerOpen(true);
  };

  const findMyLocation = async () => {
    setStatus('locating');
    const point = await locate();
    if (point === null) locationFailed();
    else choose({ kind: 'near', point });
  };

  /**
   * The place to search, for a submit: asks the browser for the position first when "near
   * me" doesn't have it yet. Null when that failed (the line then says so).
   */
  const resolve = async (): Promise<SearchLocation | null> => {
    const known = locationOf(mode);
    if (known !== null) return known;
    setStatus('locating');
    const point = await locate();
    if (point === null) {
      locationFailed();
      return null;
    }
    setChosen({ kind: 'near', point });
    setStatus('idle');
    return { kind: 'near', ...point };
  };

  return {
    mode,
    status,
    hydrated,
    pickerOpen,
    setPickerOpen,
    choose,
    findMyLocation,
    resolve,
  };
}

export type SearchLocationControl = ReturnType<typeof useSearchLocation>;

/**
 * The line and its picker, inside a GET form: the city picker is the form's `cityCode`, and
 * a known position goes in hidden `lat`/`lng` fields. `children` end the picker (the
 * emergency view's "Show clinics" button for browsers without JavaScript).
 */
export function LocationPicker({
  control,
  cities,
  failedMessage,
  pendingMessage,
  children,
}: {
  control: SearchLocationControl;
  cities: City[];
  /** What to say when the position couldn't be found. */
  failedMessage: string;
  /** Said (with a spinner) while the form's next page loads; null when idle. */
  pendingMessage?: string | null;
  children?: ReactNode;
}) {
  const t = useTranslations('Search');
  const { mode, status, hydrated, pickerOpen, setPickerOpen, choose, findMyLocation } = control;

  const cityName = (code: string) =>
    cities.find((city) => city.code === code)?.name ?? t('thisCity');
  const locationLabel =
    mode.kind === 'near'
      ? t('location.near')
      : mode.kind === 'city'
        ? t('location.city', { city: cityName(mode.code) })
        : t('location.all');
  const point = mode.kind === 'near' ? mode.point : null;

  return (
    <>
      {point !== null && (
        <>
          <input type="hidden" name="lat" value={point.lat} />
          <input type="hidden" name="lng" value={point.lng} />
          {point.radiusKm !== undefined && (
            <input type="hidden" name="radiusKm" value={point.radiusKm} />
          )}
        </>
      )}

      <details
        open={pickerOpen}
        onToggle={(event) => {
          setPickerOpen(event.currentTarget.open);
        }}
        className="group"
      >
        <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-1.5 rounded-md [&::-webkit-details-marker]:hidden">
          <MapPin aria-hidden className="size-5 shrink-0 text-muted-foreground" />
          <span className="font-semibold">{locationLabel}</span>
          <span className="font-semibold text-primary underline underline-offset-4 group-open:hidden">
            {t('changeLocation')}
          </span>
        </summary>
        <fieldset className="mt-1 flex flex-col gap-3 rounded-xl bg-muted p-3">
          <legend className="sr-only">{t('locationTitle')}</legend>
          {hydrated && (
            <button
              type="button"
              onClick={() => void findMyLocation()}
              disabled={status === 'locating'}
              className="flex min-h-12 items-center justify-center gap-2 self-start rounded-xl border-2 border-primary bg-background px-4 font-bold text-primary transition-colors duration-150 hover:bg-muted active:translate-y-px disabled:opacity-70 motion-reduce:transition-none focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              <LocateFixed aria-hidden className="size-5" />
              {t('useMyLocation')}
            </button>
          )}
          <label className="flex flex-col gap-1.5">
            <span className="font-semibold">{t('cityLabel')}</span>
            <select
              name="cityCode"
              value={mode.kind === 'city' ? mode.code : mode.kind === 'near' ? 'near' : ''}
              onChange={(event) => {
                const { value } = event.currentTarget;
                if (value === 'near') return;
                choose(value === '' ? { kind: 'all' } : { kind: 'city', code: value });
              }}
              className="min-h-12 rounded-xl border-2 border-input bg-background px-3 text-base focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              {mode.kind === 'near' && <option value="near">{t('location.near')}</option>}
              <option value="">{t('allAreas')}</option>
              {cities.map((city) => (
                <option key={city.code} value={city.code}>
                  {city.name}
                </option>
              ))}
              {/* The default city before it has listings (a new staging database). */}
              {mode.kind === 'city' && !cities.some((city) => city.code === mode.code) && (
                <option value={mode.code}>{cityName(mode.code)}</option>
              )}
            </select>
          </label>
          {children}
        </fieldset>
      </details>

      <p aria-live="polite" className="empty:hidden">
        {(status === 'locating' || typeof pendingMessage === 'string') && (
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <LoaderCircle aria-hidden className="size-4 animate-spin motion-reduce:animate-none" />
            {status === 'locating' ? t('locating') : pendingMessage}
          </span>
        )}
        {status === 'failed' && <span className="font-semibold">{failedMessage}</span>}
      </p>
    </>
  );
}

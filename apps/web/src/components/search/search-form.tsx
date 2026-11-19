'use client';

import { HeartPulse, LoaderCircle, LocateFixed, MapPin, Search } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState, useSyncExternalStore, type SyntheticEvent } from 'react';
import type { City } from '@/lib/public-types';
import { searchHref, type SearchLocation, type SearchState } from '@/lib/search-href';
import { cn } from '@/lib/utils';

// The search box with its location line and quick chips (DESIGN UX1). Location is optional
// and asked for only when the owner wants "near me"; if it's refused, they pick a city.
//
// Without JavaScript it's a plain GET form to /search: the text, the chip pressed and the
// city in the picker (Angeles City by default) go in the URL. With it, "near me" adds the
// owner's position, rounded (ARCHITECTURE D46). The browser remembers only which kind of
// location the owner chose ("near me", or a city), never the position itself.

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

/** The last non-empty value of a field: a chip's "q" comes after the search box's. */
function lastValue(data: FormData, name: string): string | undefined {
  return data
    .getAll(name)
    .map(String)
    .filter((value) => value.trim() !== '')
    .at(-1);
}

const chip =
  'inline-flex min-h-11 items-center gap-1.5 rounded-xl border-2 bg-background px-3 font-bold transition-colors duration-150 hover:bg-muted active:translate-y-px motion-reduce:transition-none focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none';

export function SearchForm({
  initial,
  cities,
  defaultCityCode,
  species,
  rememberLocation = false,
}: {
  /** The search to start from: its text, location and the filters a new search keeps. */
  initial: SearchState;
  cities: City[];
  defaultCityCode: string;
  /** Species for the quick chips; the chips show only when this is given (home). */
  species?: { code: string; name: string }[];
  /** Start from the owner's remembered location instead of `initial`'s (home). */
  rememberLocation?: boolean;
}) {
  const t = useTranslations('Search');
  const router = useRouter();
  const hydrated = useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
  const saved = useSyncExternalStore(subscribeStorage, readSaved, () => null);
  const [chosen, setChosen] = useState<Mode | null>(null);
  const [status, setStatus] = useState<'idle' | 'locating' | 'failed'>('idle');
  const [pickerOpen, setPickerOpen] = useState(false);

  const mode: Mode =
    chosen ?? (rememberLocation ? savedMode(saved) : null) ?? modeOf(initial.location);

  const choose = (next: Mode) => {
    setChosen(next);
    save(next);
    setStatus('idle');
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

  const onSubmit = async (event: SyntheticEvent<HTMLFormElement, SubmitEvent>) => {
    event.preventDefault();
    const { submitter } = event.nativeEvent;
    const data = new FormData(event.currentTarget, submitter);

    let location: SearchLocation;
    if (mode.kind === 'near') {
      let point = mode.point;
      if (point === null) {
        setStatus('locating');
        point = await locate();
        if (point === null) {
          locationFailed();
          return;
        }
        setChosen({ kind: 'near', point });
        setStatus('idle');
      }
      location = { kind: 'near', ...point };
    } else {
      location = mode;
    }

    const state: SearchState = { location };
    const q = lastValue(data, 'q');
    if (q !== undefined) state.q = q;
    const speciesCode = lastValue(data, 'species');
    if (speciesCode !== undefined) state.species = speciesCode;
    const category = lastValue(data, 'category');
    if (category !== undefined) state.category = category;
    if (lastValue(data, 'openNow') === 'true') state.openNow = true;
    if (lastValue(data, 'emergency') === 'true') state.emergency = true;
    router.push(searchHref(state));
  };

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
    <form
      action="/search"
      role="search"
      onSubmit={(event) => void onSubmit(event)}
      className="flex flex-col gap-3"
    >
      <label htmlFor="search-q" className="font-bold">
        {t('searchLabel')}
      </label>
      <div className="flex gap-2">
        <input
          id="search-q"
          name="q"
          type="search"
          defaultValue={initial.q}
          placeholder={t('searchPlaceholder')}
          enterKeyHint="search"
          autoComplete="off"
          className="min-h-12 min-w-0 flex-1 rounded-xl border-2 border-input bg-background px-4 text-base placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        />
        <button
          type="submit"
          disabled={status === 'locating'}
          className="flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-xl bg-primary px-4 font-bold text-primary-foreground transition-[filter] duration-150 hover:brightness-85 active:translate-y-px disabled:opacity-70 motion-reduce:transition-none focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          <Search aria-hidden className="size-5" />
          <span className="max-sm:sr-only">{t('submit')}</span>
        </button>
      </div>

      {/* The filters a new search keeps (results page); the chips add their own. */}
      {initial.species !== undefined && species === undefined && (
        <input type="hidden" name="species" value={initial.species} />
      )}
      {initial.category !== undefined && (
        <input type="hidden" name="category" value={initial.category} />
      )}
      {initial.openNow === true && <input type="hidden" name="openNow" value="true" />}
      {initial.emergency === true && <input type="hidden" name="emergency" value="true" />}
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
        </fieldset>
      </details>

      <p aria-live="polite" className="empty:hidden">
        {status === 'locating' && (
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <LoaderCircle aria-hidden className="size-4 animate-spin motion-reduce:animate-none" />
            {t('locating')}
          </span>
        )}
        {status === 'failed' && <span className="font-semibold">{t('locationFailed')}</span>}
      </p>

      {species !== undefined && (
        <ul aria-label={t('chipsLabel')} className="flex flex-wrap gap-2">
          <li>
            <button
              type="submit"
              name="openNow"
              value="true"
              className={cn(chip, 'border-primary text-primary')}
            >
              {t('chips.openNow')}
            </button>
          </li>
          <li>
            <button
              type="submit"
              name="emergency"
              value="true"
              className={cn(chip, 'border-emergency text-emergency')}
            >
              <HeartPulse aria-hidden className="size-5" />
              {t('chips.emergency')}
            </button>
          </li>
          <li>
            <button
              type="submit"
              name="q"
              value="kapon"
              className={cn(chip, 'border-primary text-primary')}
            >
              {t('chips.kapon')}
            </button>
          </li>
          <li>
            <button
              type="submit"
              name="q"
              value="bakuna"
              className={cn(chip, 'border-primary text-primary')}
            >
              {t('chips.bakuna')}
            </button>
          </li>
          {species.map((item) => (
            <li key={item.code}>
              <button
                type="submit"
                name="species"
                value={item.code}
                className={cn(chip, 'border-primary text-primary')}
              >
                {item.name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </form>
  );
}

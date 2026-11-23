'use client';

import { HeartPulse, LoaderCircle, Search } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState, useTransition, type ReactNode, type SyntheticEvent } from 'react';
import type { City } from '@/lib/public-types';
import { emergencyHref, searchHref, type SearchState } from '@/lib/search-href';
import { cn } from '@/lib/utils';
import { LocationPicker, useSearchLocation } from './location-picker';

// The search box with its location line and quick chips (DESIGN UX1).
//
// Without JavaScript it's a plain GET form to /search: the text, the chip pressed and the
// city in the picker (Angeles City by default) go in the URL; the Emergency chip goes to
// /emergency instead. With it, "near me" adds the owner's position, rounded (ARCHITECTURE
// D46), and the browser remembers which kind of location was chosen (location-picker.tsx).

/** The last non-empty value of a field: a chip's "q" comes after the search box's. */
function lastValue(data: FormData, name: string): string | undefined {
  return data
    .getAll(name)
    .map(String)
    .filter((value) => value.trim() !== '')
    .at(-1);
}

/** Which button sent the form ("q=kapon", "emergency=true"; "" for the search button). */
function submitterKey(submitter: HTMLElement | null): string {
  if (!(submitter instanceof HTMLButtonElement) || submitter.name === '') return '';
  return `${submitter.name}=${submitter.value}`;
}

const spinner = (
  <LoaderCircle aria-hidden className="size-5 animate-spin motion-reduce:animate-none" />
);

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
  const location = useSearchLocation({
    initial: initial.location,
    defaultCityCode,
    rememberLocation,
  });
  // The next page renders on the server (no loading.tsx, see pending.tsx): while it loads,
  // the button or chip that was pressed shows a spinner and the status line says so.
  const [pending, startTransition] = useTransition();
  const [pressed, setPressed] = useState('');
  const go = (href: string) => {
    startTransition(() => {
      router.push(href);
    });
  };

  const onSubmit = async (event: SyntheticEvent<HTMLFormElement, SubmitEvent>) => {
    event.preventDefault();
    const { submitter } = event.nativeEvent;
    const data = new FormData(event.currentTarget, submitter);
    setPressed(submitterKey(submitter));
    const place = await location.resolve();

    // The Emergency chip opens the emergency view, which takes only the place (UX7). If the
    // position couldn't be found, it still goes, to the default city: in an emergency the
    // owner shouldn't be left on the home page picking a city (they can change it there).
    if (lastValue(data, 'emergency') === 'true') {
      go(emergencyHref(place ?? { kind: 'city', code: defaultCityCode }));
      return;
    }
    if (place === null) return;
    const state: SearchState = { location: place };
    const q = lastValue(data, 'q');
    if (q !== undefined) state.q = q;
    const speciesCode = lastValue(data, 'species');
    if (speciesCode !== undefined) state.species = speciesCode;
    const category = lastValue(data, 'category');
    if (category !== undefined) state.category = category;
    if (lastValue(data, 'openNow') === 'true') state.openNow = true;
    go(searchHref(state));
  };

  /** A chip's icon, or a spinner while the search it started loads. */
  const chipIcon = (key: string, icon?: ReactNode) => (pending && pressed === key ? spinner : icon);

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
          disabled={location.status === 'locating'}
          className="flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-xl bg-primary px-4 font-bold text-primary-foreground transition-[filter] duration-150 hover:brightness-85 active:translate-y-px disabled:opacity-70 motion-reduce:transition-none focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          {pending && pressed === '' ? spinner : <Search aria-hidden className="size-5" />}
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

      <LocationPicker
        control={location}
        cities={cities}
        failedMessage={t('locationFailed')}
        pendingMessage={pending ? t('searching') : null}
      />

      {species !== undefined && (
        <ul aria-label={t('chipsLabel')} className="flex flex-wrap gap-2">
          <li>
            <button
              type="submit"
              name="openNow"
              value="true"
              className={cn(chip, 'border-primary text-primary')}
            >
              {chipIcon('openNow=true')}
              {t('chips.openNow')}
            </button>
          </li>
          <li>
            <button
              type="submit"
              name="emergency"
              value="true"
              // Without JavaScript the browser goes straight to the emergency view.
              formAction="/emergency"
              className={cn(chip, 'border-emergency text-emergency')}
            >
              {chipIcon('emergency=true', <HeartPulse aria-hidden className="size-5" />)}
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
              {chipIcon('q=kapon')}
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
              {chipIcon('q=bakuna')}
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
                {chipIcon(`species=${item.code}`)}
                {item.name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </form>
  );
}

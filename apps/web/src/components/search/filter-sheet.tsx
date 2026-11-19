import { SlidersHorizontal, X } from 'lucide-react';
import Form from 'next/form';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { outlineAction, primaryAction } from '@/lib/action-styles';
import type { Taxonomy } from '@/lib/public-types';
import { firstPage, searchHref, type SearchState } from '@/lib/search-href';
import { cn } from '@/lib/utils';

// The filter sheet (DESIGN §8 FilterSheet): animal, service and "open now", in a sheet that
// slides over the results. Built on the browser's Popover API, so it opens, closes on Esc
// or a tap outside, and submits without any JavaScript of ours; next/form turns the submit
// into a client-side navigation when JavaScript is there. The page gives it a `key` per
// search, so after "Show results" a fresh, closed sheet replaces the open one.

const SHEET_ID = 'search-filters';

/** The button that opens the sheet, with the number of filters in use. */
export async function FilterButton({ active }: { active: number }) {
  const t = await getTranslations('Search');
  return (
    <button type="button" popoverTarget={SHEET_ID} className={cn(outlineAction, 'px-4')}>
      <SlidersHorizontal aria-hidden className="size-5" />
      {t('filters')}
      {active > 0 && (
        <span className="rounded-md bg-primary px-1.5 text-sm text-primary-foreground">
          {active}
        </span>
      )}
    </button>
  );
}

export async function FilterSheet({ state, taxonomy }: { state: SearchState; taxonomy: Taxonomy }) {
  const t = await getTranslations('Search');
  const { location } = state;
  const cleared = searchHref(firstPage({ location, ...(state.q !== undefined && { q: state.q }) }));

  return (
    <div
      id={SHEET_ID}
      popover="auto"
      role="dialog"
      aria-labelledby={`${SHEET_ID}-title`}
      // A bottom sheet on phones, a centered panel from tablet width; the browser closes it on
      // Esc or a tap outside.
      className="inset-x-0 bottom-0 mx-auto mt-auto mb-0 h-fit max-h-[85dvh] w-full max-w-lg overflow-y-auto rounded-t-2xl border-0 bg-background p-5 text-foreground shadow-xl backdrop:bg-foreground/40 sm:my-auto sm:rounded-2xl"
    >
      <Form action="/search" className="flex flex-col gap-6">
        <div className="flex items-center justify-between gap-4 border-b-2 pb-3">
          <h2 id={`${SHEET_ID}-title`} className="text-xl font-extrabold">
            {t('filtersTitle')}
          </h2>
          <button
            type="button"
            popoverTarget={SHEET_ID}
            popoverTargetAction="hide"
            className="inline-flex min-h-11 items-center gap-1.5 rounded-md px-2 font-semibold text-primary hover:bg-muted"
          >
            <X aria-hidden className="size-5" />
            {t('closeFilters')}
          </button>
        </div>

        {/* What the filters don't change: the words and the place. */}
        {state.q !== undefined && <input type="hidden" name="q" value={state.q} />}
        {location.kind === 'near' && (
          <>
            <input type="hidden" name="lat" value={location.lat} />
            <input type="hidden" name="lng" value={location.lng} />
            {location.radiusKm !== undefined && (
              <input type="hidden" name="radiusKm" value={location.radiusKm} />
            )}
          </>
        )}
        {location.kind === 'city' && <input type="hidden" name="cityCode" value={location.code} />}
        {state.emergency === true && <input type="hidden" name="emergency" value="true" />}

        <fieldset className="flex flex-col gap-1">
          <legend className="mb-2 text-sm font-extrabold tracking-wider text-muted-foreground uppercase">
            {t('animal')}
          </legend>
          <div className="flex flex-wrap gap-2">
            {[{ code: '', name: t('anyAnimal') }, ...taxonomy.species].map((item) => (
              <label
                key={item.code}
                className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border-2 px-3 font-semibold has-checked:border-primary has-checked:bg-muted has-focus-visible:ring-3 has-focus-visible:ring-ring/50"
              >
                <input
                  type="radio"
                  name="species"
                  value={item.code}
                  defaultChecked={(state.species ?? '') === item.code}
                  className="size-4 accent-primary"
                />
                {item.name}
              </label>
            ))}
          </div>
        </fieldset>

        <label className="flex flex-col gap-2">
          <span className="text-sm font-extrabold tracking-wider text-muted-foreground uppercase">
            {t('service')}
          </span>
          <select
            name="category"
            defaultValue={state.category ?? ''}
            className="min-h-12 rounded-xl border-2 border-input bg-background px-3 text-base focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            <option value="">{t('anyService')}</option>
            {taxonomy.categories.map((group) => (
              <optgroup key={group.code} label={group.name}>
                <option value={group.code}>{t('allInGroup', { group: group.name })}</option>
                {group.children.map((category) => (
                  <option key={category.code} value={category.code}>
                    {category.name}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>

        <label className="flex min-h-11 cursor-pointer items-center gap-3 font-semibold">
          <input
            type="checkbox"
            name="openNow"
            value="true"
            defaultChecked={state.openNow === true}
            className="size-5 accent-primary"
          />
          {t('openNowOnly')}
        </label>

        <div className="flex flex-col-reverse gap-2 border-t-2 pt-4 sm:flex-row sm:justify-end">
          <Link href={cleared} className={cn(outlineAction, 'px-5')}>
            {t('clearFilters')}
          </Link>
          <button type="submit" className={cn(primaryAction, 'px-5')}>
            {t('applyFilters')}
          </button>
        </div>
      </Form>
    </div>
  );
}

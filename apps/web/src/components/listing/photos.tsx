import { X } from 'lucide-react';
import Image from 'next/image';
import { getTranslations } from 'next-intl/server';
import { outlineAction } from '@/lib/action-styles';
import type { ListingImage } from '@/lib/public-types';
import { cn } from '@/lib/utils';
import { Section } from './sections';

/**
 * The branch's photos as a sideways-scrolling strip (DESIGN UX8). CSS scroll snapping lands
 * each swipe on a photo. About 85% of the width on phones and about 3¼ across from tablet
 * width, so the next photo always peeks in. Below the fold, so they load lazily.
 *
 * Tapping a photo enlarges it, with no client JavaScript: each photo is a button that opens
 * its own popover (the browser's Popover API), which closes with Close, Esc, or a tap
 * outside. The large version is only downloaded when it's opened (a lazy image in a hidden
 * popover isn't fetched). There's no previous/next inside it: a popover opened from another
 * one stacks on top of it instead of replacing it, so owners close it and tap the next.
 */
export async function PhotoStrip({ photos, name }: { photos: ListingImage[]; name: string }) {
  if (photos.length === 0) return null;
  const t = await getTranslations('Listing');
  const popoverId = (index: number) => `photo-${String(index + 1)}`;

  return (
    <Section id="photos" title={t('photosTitle')}>
      <p className="-mt-2 text-sm text-muted-foreground">
        {t('photoCount', { count: photos.length })}
      </p>
      {/*
        Labelled, so screen readers announce what it holds and that it scrolls. Keyboard users
        reach each photo's button, which scrolls it into view.
      */}
      <div
        role="region"
        aria-label={t('photosLabel', { name })}
        className="snap-x snap-mandatory overflow-x-auto overscroll-x-contain rounded-xl pb-2"
      >
        <ul className="flex gap-3">
          {photos.map((photo, index) => (
            <li
              key={photo.url}
              className="relative aspect-[4/3] w-[85%] shrink-0 snap-start overflow-hidden rounded-xl bg-muted sm:w-[calc((100%-2.25rem)/3.25)]"
            >
              <button
                type="button"
                popoverTarget={popoverId(index)}
                // The tile clips its corners, so the focus ring sits inside it.
                className="absolute inset-0 cursor-zoom-in transition-[filter] duration-150 hover:brightness-90 focus-visible:-outline-offset-4 active:brightness-85 motion-reduce:transition-none"
              >
                <span className="sr-only">{t('photoEnlarge')} </span>
                <Image
                  src={photo.url}
                  alt={photo.alt}
                  fill
                  // The page is at most 64rem wide (the public layout): ~3¼ across is ~300px.
                  sizes="(min-width: 1024px) 300px, (min-width: 640px) 30vw, 85vw"
                  className="object-cover"
                />
              </button>
            </li>
          ))}
        </ul>
      </div>

      {photos.map((photo, index) => (
        <div
          key={photo.url}
          id={popoverId(index)}
          popover="auto"
          role="dialog"
          aria-label={photo.alt}
          // Centered on a dark backdrop; the browser closes it on Esc or a tap outside.
          className="m-auto h-fit max-h-dvh w-full max-w-5xl overflow-y-auto border-0 bg-transparent p-4 text-background backdrop:bg-foreground/85"
        >
          <figure className="flex flex-col gap-3">
            <Image
              src={photo.url}
              alt={photo.alt}
              width={photo.width}
              height={photo.height}
              sizes="(min-width: 1056px) 1024px, 100vw"
              // Fits the screen whatever its shape, leaving room for the caption row.
              className="mx-auto h-auto max-h-[calc(100dvh-8rem)] w-auto max-w-full rounded-xl object-contain"
            />
            <div className="flex items-center justify-between gap-4">
              <figcaption className="min-w-0">
                <span className="font-medium">{photo.alt}</span>
                <span className="block text-sm">
                  {t('photoPosition', { position: index + 1, count: photos.length })}
                </span>
              </figcaption>
              <button
                type="button"
                popoverTarget={popoverId(index)}
                popoverTargetAction="hide"
                className={cn(outlineAction, 'shrink-0 px-4')}
              >
                <X aria-hidden className="size-5" />
                {t('photoClose')}
              </button>
            </div>
          </figure>
        </div>
      ))}
    </Section>
  );
}

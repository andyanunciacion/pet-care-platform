'use client';

// A branch's photos (ARCHITECTURE D38): upload with alt text, edit the alt text, reorder,
// delete. The order is the clinic page's order; the first photo is the main one.

import { ArrowDown, ArrowUp, Pencil, Trash2 } from 'lucide-react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';
import { deleteMediaAction, reorderPhotosAction } from '@/app/admin/actions';
import { Button } from '@/components/ui/button';
import type { Media } from '@/lib/admin-types';
import { AltTextForm } from './alt-text-form';
import { ImageUpload } from './image-upload';

interface Props {
  branchId: string;
  photos: Media[];
  limit: number;
}

export function PhotosEditor({ branchId, photos, limit }: Props) {
  const t = useTranslations('AdminPhotos');
  const [editing, setEditing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function run(action: () => Promise<{ status: string }>, failure: string) {
    setError(null);
    startTransition(async () => {
      if ((await action()).status === 'error') setError(failure);
    });
  }

  function move(index: number, by: -1 | 1) {
    const ids = photos.map((photo) => photo.id);
    const [moved] = ids.splice(index, 1);
    if (moved === undefined) return;
    ids.splice(index + by, 0, moved);
    run(() => reorderPhotosAction(branchId, ids), t('reorderFailed'));
  }

  return (
    <div className="flex flex-col gap-8">
      <section aria-labelledby="photos-heading" className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h2 id="photos-heading" className="text-lg font-semibold">
            {t('title')}
          </h2>
          <p className="text-sm text-muted-foreground">
            {t('hint')} {t('count', { count: photos.length, limit })}
          </p>
        </div>

        {photos.length === 0 ? (
          <p className="rounded-lg border border-dashed p-6 text-muted-foreground">{t('empty')}</p>
        ) : (
          <ol className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {photos.map((photo, index) => (
              <li key={photo.id} className="flex flex-col gap-2 rounded-lg border p-2">
                {/* Stored as-is (already resized), so no optimization; width/height keep the
                    space reserved while it loads. */}
                <Image
                  src={photo.url}
                  alt={photo.alt}
                  width={photo.width}
                  height={photo.height}
                  unoptimized
                  className="aspect-[4/3] w-full rounded-md bg-muted object-cover"
                />
                {editing === photo.id ? (
                  <AltTextForm
                    mediaId={photo.id}
                    alt={photo.alt}
                    onDone={() => {
                      setEditing(null);
                    }}
                  />
                ) : (
                  <p className="text-sm">
                    <span className="text-muted-foreground">{String(index + 1)}. </span>
                    {photo.alt}
                  </p>
                )}
                <div className="flex flex-wrap gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={pending || index === 0}
                    aria-label={t('moveUpLabel', { alt: photo.alt })}
                    onClick={() => {
                      move(index, -1);
                    }}
                  >
                    <ArrowUp aria-hidden />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={pending || index === photos.length - 1}
                    aria-label={t('moveDownLabel', { alt: photo.alt })}
                    onClick={() => {
                      move(index, 1);
                    }}
                  >
                    <ArrowDown aria-hidden />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setEditing(photo.id);
                    }}
                  >
                    <Pencil aria-hidden />
                    {t('editAlt')}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={pending}
                    onClick={() => {
                      run(() => deleteMediaAction(photo.id), t('removeFailed'));
                    }}
                  >
                    <Trash2 aria-hidden />
                    {t('remove')}
                  </Button>
                </div>
              </li>
            ))}
          </ol>
        )}
        {error !== null && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
      </section>

      <section aria-labelledby="add-photo-heading" className="flex flex-col gap-4">
        <h2 id="add-photo-heading" className="text-lg font-semibold">
          {t('addPhoto')}
        </h2>
        {photos.length >= limit ? (
          <p className="text-sm text-muted-foreground">{t('full')}</p>
        ) : (
          <div className="rounded-lg border p-3">
            <ImageUpload purpose="branch_photo" ownerId={branchId} submitLabel={t('upload')} />
          </div>
        )}
      </section>
    </div>
  );
}

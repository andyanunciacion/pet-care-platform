'use client';

// The business's logo (one per business): upload, replace, edit the alt text, delete.

import { Pencil, Trash2 } from 'lucide-react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';
import { deleteMediaAction } from '@/app/admin/actions';
import { Button } from '@/components/ui/button';
import type { Media } from '@/lib/admin-types';
import { AltTextForm } from './alt-text-form';
import { ImageUpload } from './image-upload';

export function LogoEditor({ businessId, logo }: { businessId: string; logo: Media | null }) {
  const t = useTranslations('AdminPhotos');
  const [mode, setMode] = useState<'view' | 'replace' | 'alt'>('view');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const close = () => {
    setMode('view');
  };

  return (
    <section aria-labelledby="logo-heading" className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 id="logo-heading" className="text-xl font-semibold">
          {t('logoTitle')}
        </h2>
        <p className="text-sm text-muted-foreground">{t('logoHint')}</p>
      </div>

      {logo === null ? (
        <div className="rounded-lg border p-3">
          <ImageUpload purpose="business_logo" ownerId={businessId} submitLabel={t('upload')} />
        </div>
      ) : (
        <div className="flex flex-wrap items-start gap-4">
          <Image
            src={logo.url}
            alt={logo.alt}
            width={logo.width}
            height={logo.height}
            unoptimized
            className="size-24 rounded-md border bg-muted object-contain"
          />
          <div className="flex min-w-64 flex-1 flex-col gap-2">
            {mode === 'alt' ? (
              <AltTextForm mediaId={logo.id} alt={logo.alt} onDone={close} />
            ) : (
              <p className="text-sm">{logo.alt}</p>
            )}
            {mode === 'replace' ? (
              <div className="rounded-lg border p-3">
                <ImageUpload
                  purpose="business_logo"
                  ownerId={businessId}
                  submitLabel={t('replaceLogo')}
                  onDone={close}
                  onCancel={close}
                />
              </div>
            ) : (
              <div className="flex flex-wrap gap-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setMode('replace');
                  }}
                >
                  {t('replaceLogo')}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setMode('alt');
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
                    setError(null);
                    startTransition(async () => {
                      const result = await deleteMediaAction(logo.id);
                      if (result.status === 'error') setError(t('removeFailed'));
                    });
                  }}
                >
                  <Trash2 aria-hidden />
                  {t('remove')}
                </Button>
              </div>
            )}
            {error !== null && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

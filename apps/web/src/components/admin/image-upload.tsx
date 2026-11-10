'use client';

// Uploads one image (a branch photo, the logo or a product image; ARCHITECTURE D38):
// resize in the browser → ask the API for an upload URL → PUT the file straight to storage
// → finalize, which records it with its alt text.

import { IMAGE_MAX_EDGE, MAX_UPLOAD_BYTES } from '@paw/domain';
import { Upload } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useId, useState, useTransition, type SubmitEvent } from 'react';
import { finalizeUploadAction, requestUploadAction } from '@/app/admin/actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { UploadPurpose } from '@/lib/admin-types';
import { errorAt, idleForm, type FormState } from '@/lib/form-errors';
import { resizeForUpload } from '@/lib/image-resize';
import { describedBy, FormField, FormStatus } from './form-field';

interface Props {
  purpose: UploadPurpose;
  /** The branch, business or product the image belongs to. */
  ownerId: string;
  submitLabel: string;
  /** Called after the image is saved (e.g. to close the form). */
  onDone?: () => void;
  onCancel?: () => void;
}

export function ImageUpload({ purpose, ownerId, submitLabel, onDone, onCancel }: Props) {
  const t = useTranslations('AdminPhotos');
  const tForms = useTranslations('AdminForms');
  const id = useId();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [alt, setAlt] = useState('');
  const [state, setState] = useState<FormState>(idleForm);
  const [pending, startTransition] = useTransition();
  const [inputKey, setInputKey] = useState(0);

  // The preview is a blob: URL; release it when it changes or the form goes away.
  useEffect(
    () => () => {
      if (preview !== null) URL.revokeObjectURL(preview);
    },
    [preview],
  );

  const fail = (formError: string | null, fieldErrors: Record<string, string> = {}) => {
    setState({ status: 'error', formError, fieldErrors });
  };

  function onSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (file === null) {
      fail(null, { file: t('pickFile') });
      return;
    }
    if (alt.trim() === '') {
      fail(null, { alt: t('altRequired') });
      return;
    }
    startTransition(async () => {
      const resized = await resizeForUpload(file, purpose);
      if (resized === null) {
        fail(null, { file: t('unreadable') });
        return;
      }
      if (resized.blob.size > MAX_UPLOAD_BYTES) {
        fail(null, { file: t('tooBig') });
        return;
      }

      const { state: requested, upload } = await requestUploadAction({
        purpose,
        ownerId,
        contentType: resized.contentType,
        contentLength: resized.blob.size,
      });
      if (upload === null) {
        setState(requested);
        return;
      }

      // Straight to storage (not through our API): the one browser call to another origin.
      let uploaded: boolean;
      try {
        const response = await fetch(upload.uploadUrl, {
          method: 'PUT',
          body: resized.blob,
          headers: { 'content-type': resized.contentType },
        });
        uploaded = response.ok;
      } catch {
        uploaded = false;
      }
      if (!uploaded) {
        fail(t('uploadFailed'));
        return;
      }

      const result = await finalizeUploadAction(purpose, ownerId, {
        storageKey: upload.storageKey,
        alt: alt.trim(),
        width: resized.width,
        height: resized.height,
      });
      setState(result);
      if (result.status !== 'saved') return;
      setFile(null);
      setPreview(null);
      setAlt('');
      setInputKey((key) => key + 1);
      onDone?.();
    });
  }

  const fileError = errorAt(state, 'file');
  const altError = errorAt(state, 'alt');
  const fileHint = t('chooseHint', { size: IMAGE_MAX_EDGE[purpose] });

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start gap-4">
        {preview !== null && (
          // A local blob: preview, not a stored image, so next/image doesn't apply.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="" className="size-24 rounded-md border object-cover" />
        )}
        <div className="flex min-w-64 flex-1 flex-col gap-4">
          <FormField id={`${id}-file`} label={t('chooseImage')} hint={fileHint} error={fileError}>
            <Input
              key={inputKey}
              id={`${id}-file`}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/heic"
              aria-invalid={fileError !== undefined}
              aria-describedby={describedBy(`${id}-file`, fileHint, fileError)}
              onChange={(event) => {
                const picked = event.target.files?.[0] ?? null;
                setFile(picked);
                setPreview(picked === null ? null : URL.createObjectURL(picked));
                setState(idleForm);
              }}
            />
          </FormField>
          <FormField id={`${id}-alt`} label={t('alt')} hint={t('altHint')} error={altError}>
            <Input
              id={`${id}-alt`}
              maxLength={300}
              value={alt}
              aria-invalid={altError !== undefined}
              aria-describedby={describedBy(`${id}-alt`, t('altHint'), altError)}
              onChange={(event) => {
                setAlt(event.target.value);
              }}
            />
          </FormField>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending}>
          <Upload aria-hidden />
          {pending ? t('uploading') : submitLabel}
        </Button>
        {onCancel !== undefined && (
          <Button type="button" variant="ghost" onClick={onCancel}>
            {t('cancel')}
          </Button>
        )}
        <FormStatus
          formError={state.formError}
          hasFieldErrors={Object.keys(state.fieldErrors).length > 0}
          saved={state.status === 'saved' && !pending}
          fixErrorsLabel={tForms('fixErrors')}
          savedLabel={t('uploaded')}
        />
      </div>
    </form>
  );
}

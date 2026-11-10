'use client';

import { useTranslations } from 'next-intl';
import { useId, useState, useTransition, type SubmitEvent } from 'react';
import { updateMediaAltAction } from '@/app/admin/actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { errorAt, idleForm, type FormState } from '@/lib/form-errors';
import { describedBy, FormField } from './form-field';

/** Edits one image's alt text in place. */
export function AltTextForm({
  mediaId,
  alt: savedAlt,
  onDone,
}: {
  mediaId: string;
  alt: string;
  onDone: () => void;
}) {
  const t = useTranslations('AdminPhotos');
  const tForms = useTranslations('AdminForms');
  const id = useId();
  const [alt, setAlt] = useState(savedAlt);
  const [state, setState] = useState<FormState>(idleForm);
  const [pending, startTransition] = useTransition();

  function onSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (alt.trim() === '') {
      setState({ status: 'error', formError: null, fieldErrors: { alt: t('altRequired') } });
      return;
    }
    startTransition(async () => {
      const result = await updateMediaAltAction(mediaId, alt.trim());
      setState(result);
      if (result.status === 'saved') onDone();
    });
  }

  const error = errorAt(state, 'alt') ?? state.formError ?? undefined;
  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-2">
      <FormField id={`${id}-alt`} label={t('alt')} error={error}>
        <Input
          id={`${id}-alt`}
          maxLength={300}
          value={alt}
          aria-invalid={error !== undefined}
          aria-describedby={describedBy(`${id}-alt`, undefined, error)}
          onChange={(event) => {
            setAlt(event.target.value);
          }}
        />
      </FormField>
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? tForms('saving') : t('saveAlt')}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onDone}>
          {t('cancel')}
        </Button>
      </div>
    </form>
  );
}

'use client';

import { slugify } from '@paw/domain';
import { useTranslations } from 'next-intl';
import { useState, useTransition, type SubmitEvent } from 'react';
import { createBusinessAction, updateBusinessAction } from '@/app/admin/actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import { Textarea } from '@/components/ui/textarea';
import { LISTING_STATUSES, type BusinessDetail, type ListingStatus } from '@/lib/admin-types';
import { errorAt, idleForm, type FormState } from '@/lib/form-errors';
import { describedBy, FormField, FormStatus } from './form-field';

interface Props {
  /** The business being edited; omit to create one. */
  business?: BusinessDetail;
}

export function BusinessForm({ business }: Props) {
  const t = useTranslations('AdminForms');
  const tEnums = useTranslations('Enums');
  const [state, setState] = useState<FormState>(idleForm);
  const [pending, startTransition] = useTransition();

  const [name, setName] = useState(business?.name ?? '');
  const [slug, setSlug] = useState(business?.slug ?? '');
  // New businesses: the slug follows the name until it's edited by hand. Existing ones
  // keep theirs (changing it would break links).
  const [slugEdited, setSlugEdited] = useState(business !== undefined);
  const [description, setDescription] = useState(business?.description ?? '');
  const [dataSource, setDataSource] = useState(business?.dataSource ?? '');
  const [listingStatus, setListingStatus] = useState<ListingStatus>(
    business?.listingStatus ?? 'hidden',
  );

  function onSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const body = {
      name: name.trim(),
      slug: slug.trim(),
      description: description.trim() === '' ? null : description.trim(),
      dataSource: dataSource.trim() === '' ? null : dataSource.trim(),
      listingStatus,
    };
    startTransition(async () => {
      setState(
        business === undefined
          ? await createBusinessAction({ ...body, type: 'vet_clinic' })
          : await updateBusinessAction(business.id, body),
      );
    });
  }

  const error = (field: string) => errorAt(state, field);
  const field = (id: string, hint?: string) => ({
    id,
    'aria-invalid': error(id) !== undefined,
    'aria-describedby': describedBy(id, hint, error(id)),
  });

  return (
    <form onSubmit={onSubmit} className="flex max-w-2xl flex-col gap-5" noValidate>
      <FormField id="name" label={t('name')} error={error('name')}>
        <Input
          {...field('name')}
          value={name}
          required
          maxLength={200}
          onChange={(event) => {
            setName(event.target.value);
            if (!slugEdited) setSlug(slugify(event.target.value));
          }}
        />
      </FormField>

      <FormField id="slug" label={t('slug')} hint={t('slugHint')} error={error('slug')}>
        <Input
          {...field('slug', t('slugHint'))}
          value={slug}
          required
          maxLength={80}
          className="font-mono"
          onChange={(event) => {
            setSlug(event.target.value);
            setSlugEdited(true);
          }}
        />
      </FormField>

      <FormField id="type" label={t('type')}>
        <p id="type" className="text-sm">
          {tEnums('businessType.vet_clinic')}
        </p>
      </FormField>

      <FormField
        id="description"
        label={t('description')}
        labelSuffix={t('optional')}
        error={error('description')}
      >
        <Textarea
          {...field('description')}
          value={description}
          rows={4}
          maxLength={5000}
          onChange={(event) => {
            setDescription(event.target.value);
          }}
        />
      </FormField>

      <FormField
        id="dataSource"
        label={t('dataSource')}
        labelSuffix={t('optional')}
        hint={t('dataSourceHint')}
        error={error('dataSource')}
      >
        <Input
          {...field('dataSource', t('dataSourceHint'))}
          value={dataSource}
          maxLength={500}
          onChange={(event) => {
            setDataSource(event.target.value);
          }}
        />
      </FormField>

      <FormField
        id="listingStatus"
        label={t('listingStatus')}
        hint={t('businessListingHint')}
        error={error('listingStatus')}
      >
        <NativeSelect
          {...field('listingStatus', t('businessListingHint'))}
          value={listingStatus}
          onChange={(event) => {
            setListingStatus(event.target.value as ListingStatus);
          }}
        >
          {LISTING_STATUSES.map((status) => (
            <NativeSelectOption key={status} value={status}>
              {tEnums(`listingStatus.${status}`)}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </FormField>

      <div className="flex items-center gap-4">
        <Button type="submit" disabled={pending}>
          {pending ? t('saving') : business === undefined ? t('create') : t('save')}
        </Button>
        <FormStatus
          formError={state.formError}
          hasFieldErrors={Object.keys(state.fieldErrors).length > 0}
          saved={state.status === 'saved' && !pending}
          fixErrorsLabel={t('fixErrors')}
          savedLabel={t('saved')}
        />
      </div>
    </form>
  );
}

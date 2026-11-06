'use client';

import { BUSINESS_TYPE_RULES, slugify, type LngLat } from '@paw/domain';
import { useTranslations } from 'next-intl';
import { useState, useTransition, type SubmitEvent } from 'react';
import { createBranchAction, updateBranchAction } from '@/app/admin/actions';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import {
  LISTING_STATUSES,
  type Branch,
  type BusinessDetail,
  type ListingStatus,
  type PsgcArea,
} from '@/lib/admin-types';
import { errorAt, idleForm, type FormState } from '@/lib/form-errors';
import { ContactsEditor, type ContactRow } from './contacts-editor';
import { describedBy, FormField, FormStatus } from './form-field';
import { LocationPicker } from './location-picker';
import { PsgcPicker, type AreaCodes } from './psgc-picker';

interface Props {
  business: Pick<BusinessDetail, 'id' | 'type'>;
  /** The branch being edited; omit to add one. */
  branch?: Branch;
  provinces: PsgcArea[];
  initialCities: PsgcArea[];
  initialBarangays: PsgcArea[];
  /** For a new branch: the province to start with. */
  defaultProvinceCode?: string;
}

/**
 * Keys must be the same on the server and in the browser (they end up in element ids), so
 * rows from the page use the database id or their position, never a random id.
 */
function initialContacts(branch: Branch | undefined): ContactRow[] {
  if (branch === undefined) return [{ key: 'new-0', type: 'phone', value: '', label: '' }];
  return branch.contacts.map((contact) => ({
    key: contact.id,
    type: contact.type,
    value: contact.value,
    label: contact.label ?? '',
  }));
}

export function BranchForm({ business, branch, ...areas }: Props) {
  const t = useTranslations('AdminForms');
  const tEnums = useTranslations('Enums');
  const [state, setState] = useState<FormState>(idleForm);
  const [pending, startTransition] = useTransition();

  const [name, setName] = useState(branch?.name ?? '');
  const [slug, setSlug] = useState(branch?.slug ?? '');
  const [slugEdited, setSlugEdited] = useState(branch !== undefined);
  const [addressLine, setAddressLine] = useState(branch?.addressLine ?? '');
  const [codes, setCodes] = useState<AreaCodes>({
    provinceCode: branch?.province.code ?? areas.defaultProvinceCode ?? '',
    cityCode: branch?.city.code ?? '',
    barangayCode: branch?.barangay?.code ?? null,
  });
  const [location, setLocation] = useState<LngLat | null>(branch?.location ?? null);
  const [is24h, setIs24h] = useState(branch?.is24h ?? false);
  const [acceptsEmergencies, setAcceptsEmergencies] = useState(branch?.acceptsEmergencies ?? false);
  const [listingStatus, setListingStatus] = useState<ListingStatus>(
    branch?.listingStatus ?? 'published',
  );
  const [contacts, setContacts] = useState(() => initialContacts(branch));
  const [sentContactKeys, setSentContactKeys] = useState<string[]>([]);

  const showEmergencyFlags = BUSINESS_TYPE_RULES[business.type].emergencyFlags;

  function onSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (location === null) {
      setState({ status: 'error', formError: null, fieldErrors: { location: t('pinMissing') } });
      return;
    }
    // Empty rows are left out, so an unused "Add contact" row doesn't block saving.
    const sent = contacts.filter((row) => row.value.trim() !== '');
    setSentContactKeys(sent.map((row) => row.key));
    const body = {
      name: name.trim(),
      slug: slug.trim(),
      addressLine: addressLine.trim(),
      ...codes,
      location,
      is24h: showEmergencyFlags && is24h,
      acceptsEmergencies: showEmergencyFlags && acceptsEmergencies,
      listingStatus,
      contacts: sent.map((row) => ({
        type: row.type,
        value: row.value.trim(),
        label: row.label.trim() === '' ? null : row.label.trim(),
      })),
    };
    startTransition(async () => {
      setState(
        branch === undefined
          ? await createBranchAction(business.id, body)
          : await updateBranchAction(branch.id, body),
      );
    });
  }

  const error = (path: string) => errorAt(state, path);
  const field = (id: string, hint?: string) => ({
    id,
    'aria-invalid': error(id) !== undefined,
    'aria-describedby': describedBy(id, hint, error(id)),
  });

  return (
    <form onSubmit={onSubmit} className="flex max-w-4xl flex-col gap-8" noValidate>
      <div className="grid gap-5 sm:grid-cols-2">
        <FormField
          id="name"
          label={t('branchName')}
          hint={t('branchNameHint')}
          error={error('name')}
        >
          <Input
            {...field('name', t('branchNameHint'))}
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
      </div>

      <div className="flex flex-col gap-5">
        <FormField
          id="addressLine"
          label={t('addressLine')}
          hint={t('addressLineHint')}
          error={error('addressLine')}
        >
          <Input
            {...field('addressLine', t('addressLineHint'))}
            value={addressLine}
            required
            maxLength={300}
            onChange={(event) => {
              setAddressLine(event.target.value);
            }}
          />
        </FormField>
        <PsgcPicker
          provinces={areas.provinces}
          initialCities={areas.initialCities}
          initialBarangays={areas.initialBarangays}
          value={codes}
          onChange={setCodes}
          errors={{
            provinceCode: error('provinceCode'),
            cityCode: error('cityCode'),
            barangayCode: error('barangayCode'),
          }}
        />
      </div>

      <section aria-labelledby="location-heading" className="flex flex-col gap-2">
        <h2 id="location-heading" className="font-medium">
          {t('location')}
        </h2>
        <p className="text-sm text-muted-foreground">{t('locationHint')}</p>
        <LocationPicker value={location} onChange={setLocation} error={error('location')} />
      </section>

      <section aria-labelledby="contacts-heading" className="flex flex-col gap-2">
        <h2 id="contacts-heading" className="font-medium">
          {t('contacts')}
        </h2>
        <p className="text-sm text-muted-foreground">{t('contactsHint')}</p>
        <ContactsEditor
          rows={contacts}
          onChange={setContacts}
          errorFor={(index, part) => {
            // The API numbers only the rows that were sent (empty ones are left out).
            const sent = sentContactKeys.indexOf(contacts[index]?.key ?? '');
            return sent === -1 ? undefined : error(`contacts.${String(sent)}.${part}`);
          }}
        />
        {state.fieldErrors.contacts !== undefined && (
          <p className="text-sm text-destructive">{state.fieldErrors.contacts}</p>
        )}
      </section>

      <div className="grid gap-5 sm:grid-cols-2">
        {showEmergencyFlags && (
          <fieldset className="flex flex-col gap-3">
            <legend className="mb-1 text-sm font-medium">{t('flags')}</legend>
            <div className="flex items-center gap-2">
              <Checkbox
                id="is24h"
                checked={is24h}
                onCheckedChange={(checked) => {
                  setIs24h(checked === true);
                }}
              />
              <Label htmlFor="is24h" className="font-normal">
                {t('is24h')}
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="acceptsEmergencies"
                checked={acceptsEmergencies}
                onCheckedChange={(checked) => {
                  setAcceptsEmergencies(checked === true);
                }}
              />
              <Label htmlFor="acceptsEmergencies" className="font-normal">
                {t('acceptsEmergencies')}
              </Label>
            </div>
          </fieldset>
        )}
        <FormField
          id="listingStatus"
          label={t('listingStatus')}
          hint={t('branchListingHint')}
          error={error('listingStatus')}
        >
          <NativeSelect
            {...field('listingStatus', t('branchListingHint'))}
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
      </div>

      <div className="flex items-center gap-4">
        <Button type="submit" disabled={pending}>
          {pending ? t('saving') : branch === undefined ? t('create') : t('save')}
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

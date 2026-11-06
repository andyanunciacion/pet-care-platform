'use client';

import { useTranslations } from 'next-intl';
import { useRef, useState } from 'react';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import type { PsgcArea } from '@/lib/admin-types';
import { browserApi } from '@/lib/browser-api';
import { describedBy, FormField } from './form-field';

export interface AreaCodes {
  provinceCode: string;
  cityCode: string;
  barangayCode: string | null;
}

interface Props {
  provinces: PsgcArea[];
  /** Cities of the selected province and barangays of the selected city, from the page. */
  initialCities: PsgcArea[];
  initialBarangays: PsgcArea[];
  value: AreaCodes;
  onChange: (value: AreaCodes) => void;
  errors: { provinceCode?: string; cityCode?: string; barangayCode?: string };
}

type ListState = { status: 'ready'; areas: PsgcArea[] } | { status: 'loading' | 'failed' };

/**
 * Province → city/municipality → barangay. Picking a level loads the next one from the
 * API, through the same-origin /v1 proxy.
 */
export function PsgcPicker(props: Props) {
  const { provinces, value, onChange, errors } = props;
  const t = useTranslations('AdminForms');
  const [cities, setCities] = useState<ListState>({ status: 'ready', areas: props.initialCities });
  const [barangays, setBarangays] = useState<ListState>({
    status: 'ready',
    areas: props.initialBarangays,
  });
  // Only the latest request per list may update it (a slow earlier answer is ignored).
  const latest = useRef({ cities: 0, barangays: 0 });

  async function load(list: 'cities' | 'barangays', parentCode: string) {
    const set = list === 'cities' ? setCities : setBarangays;
    const request = ++latest.current[list];
    set({ status: 'loading' });
    const { data } = await browserApi
      .GET('/v1/admin/psgc-areas', { params: { query: { parentCode } } })
      .catch(() => ({ data: undefined }));
    if (request !== latest.current[list]) return;
    set(data === undefined ? { status: 'failed' } : { status: 'ready', areas: data });
  }

  const areaOptions = (state: ListState) =>
    state.status === 'ready'
      ? state.areas.map((area) => (
          <NativeSelectOption key={area.code} value={area.code}>
            {area.name}
          </NativeSelectOption>
        ))
      : null;

  const statusHint = (state: ListState) =>
    state.status === 'loading'
      ? t('loadingAreas')
      : state.status === 'failed'
        ? t('areasFailed')
        : undefined;

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <FormField id="provinceCode" label={t('province')} error={errors.provinceCode}>
        <NativeSelect
          id="provinceCode"
          className="w-full"
          value={value.provinceCode}
          aria-invalid={errors.provinceCode !== undefined}
          aria-describedby={describedBy('provinceCode', undefined, errors.provinceCode)}
          onChange={(event) => {
            const provinceCode = event.target.value;
            onChange({ provinceCode, cityCode: '', barangayCode: null });
            setBarangays({ status: 'ready', areas: [] });
            if (provinceCode === '') setCities({ status: 'ready', areas: [] });
            else void load('cities', provinceCode);
          }}
        >
          <NativeSelectOption value="">{t('pickProvince')}</NativeSelectOption>
          {provinces.map((province) => (
            <NativeSelectOption key={province.code} value={province.code}>
              {province.name}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </FormField>

      <FormField id="cityCode" label={t('city')} hint={statusHint(cities)} error={errors.cityCode}>
        <NativeSelect
          id="cityCode"
          className="w-full"
          value={value.cityCode}
          disabled={value.provinceCode === '' || cities.status === 'loading'}
          aria-invalid={errors.cityCode !== undefined}
          aria-describedby={describedBy('cityCode', statusHint(cities), errors.cityCode)}
          onChange={(event) => {
            const cityCode = event.target.value;
            onChange({ ...value, cityCode, barangayCode: null });
            if (cityCode === '') setBarangays({ status: 'ready', areas: [] });
            else void load('barangays', cityCode);
          }}
        >
          <NativeSelectOption value="">{t('pickCity')}</NativeSelectOption>
          {areaOptions(cities)}
        </NativeSelect>
      </FormField>

      <FormField
        id="barangayCode"
        label={t('barangay')}
        labelSuffix={t('optional')}
        hint={statusHint(barangays)}
        error={errors.barangayCode}
      >
        <NativeSelect
          id="barangayCode"
          className="w-full"
          value={value.barangayCode ?? ''}
          disabled={value.cityCode === '' || barangays.status === 'loading'}
          aria-invalid={errors.barangayCode !== undefined}
          aria-describedby={describedBy('barangayCode', statusHint(barangays), errors.barangayCode)}
          onChange={(event) => {
            onChange({ ...value, barangayCode: event.target.value || null });
          }}
        >
          <NativeSelectOption value="">{t('noBarangay')}</NativeSelectOption>
          {areaOptions(barangays)}
        </NativeSelect>
      </FormField>
    </div>
  );
}

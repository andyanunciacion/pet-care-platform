'use client';

// A branch's Services tab: the species it treats, then its services with estimated prices
// (DESIGN UX10). Each service saves on its own; "Copy to all branches" shows what it will
// add and replace before it writes (ARCHITECTURE D37).

import { formatPesos, parsePesos } from '@paw/domain';
import { Copy, Pencil, Plus, Trash2 } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useState, useTransition, type SubmitEvent } from 'react';
import {
  copyServiceAction,
  createServiceAction,
  deleteServiceAction,
  setSpeciesTreatedAction,
  updateServiceAction,
} from '@/app/admin/actions';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  NativeSelect,
  NativeSelectOptGroup,
  NativeSelectOption,
} from '@/components/ui/native-select';
import { Textarea } from '@/components/ui/textarea';
import {
  PRICE_UNITS,
  type BranchService,
  type BranchServices,
  type CopyServiceResult,
  type PriceUnit,
  type Taxonomy,
} from '@/lib/admin-types';
import { errorAt, idleForm, type FormState } from '@/lib/form-errors';
import { servicePriceLabel } from '@/lib/price-format';
import { priceLabels } from '@/lib/price-labels';
import { describedBy, FormField, FormStatus } from './form-field';

interface Props {
  data: BranchServices;
  taxonomy: Taxonomy;
}

export function ServicesEditor({ data, taxonomy }: Props) {
  return (
    <div className="flex flex-col gap-10">
      <SpeciesTreatedForm
        branchId={data.branchId}
        saved={data.speciesTreated}
        species={taxonomy.species}
      />
      <ServicesSection data={data} taxonomy={taxonomy} />
    </div>
  );
}

// ── Species ─────────────────────────────────────────────────────────────────────────────

function SpeciesCheckboxes({
  idPrefix,
  species,
  selected,
  onChange,
  invalid = false,
  describedById,
}: {
  idPrefix: string;
  species: Taxonomy['species'];
  selected: readonly string[];
  onChange: (selected: string[]) => void;
  invalid?: boolean;
  describedById?: string | undefined;
}) {
  return (
    <div className="flex flex-wrap gap-x-6 gap-y-3" aria-describedby={describedById}>
      {species.map((s) => {
        const id = `${idPrefix}-${s.id}`;
        return (
          <div key={s.id} className="flex items-center gap-2">
            <Checkbox
              id={id}
              checked={selected.includes(s.id)}
              aria-invalid={invalid}
              onCheckedChange={(checked) => {
                onChange(
                  checked === true
                    ? [...selected, s.id]
                    : selected.filter((selectedId) => selectedId !== s.id),
                );
              }}
            />
            <Label htmlFor={id} className="font-normal">
              {s.name}
            </Label>
          </div>
        );
      })}
    </div>
  );
}

const sameSet = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && a.every((id) => b.includes(id));

function SpeciesTreatedForm({
  branchId,
  saved,
  species,
}: {
  branchId: string;
  saved: string[];
  species: Taxonomy['species'];
}) {
  const t = useTranslations('AdminServices');
  const tForms = useTranslations('AdminForms');
  const [selected, setSelected] = useState<string[]>(saved);
  const [state, setState] = useState<FormState>(idleForm);
  const [pending, startTransition] = useTransition();

  function onSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    startTransition(async () => {
      setState(await setSpeciesTreatedAction(branchId, selected));
    });
  }

  const error = errorAt(state, 'speciesIds');
  return (
    <section aria-labelledby="species-heading">
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h2 id="species-heading" className="text-lg font-semibold">
            {t('speciesTitle')}
          </h2>
          <p id="species-hint" className="text-sm text-muted-foreground">
            {t('speciesHint')}
          </p>
        </div>
        <SpeciesCheckboxes
          idPrefix="treated"
          species={species}
          selected={selected}
          onChange={setSelected}
          invalid={error !== undefined}
          describedById="species-hint"
        />
        {error !== undefined && <p className="text-sm text-destructive">{error}</p>}
        {saved.length === 0 && (
          <p className="text-sm text-status-closing">{t('noSpeciesWarning')}</p>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={pending || sameSet(selected, saved)}>
            {pending ? tForms('saving') : t('saveSpecies')}
          </Button>
          <FormStatus
            formError={state.formError}
            hasFieldErrors={Object.keys(state.fieldErrors).length > 0}
            saved={state.status === 'saved' && !pending}
            fixErrorsLabel={tForms('fixErrors')}
            savedLabel={tForms('saved')}
          />
        </div>
      </form>
    </section>
  );
}

// ── Services ────────────────────────────────────────────────────────────────────────────

/** Services in the API's order, split into runs of the same category group. */
function byGroup(services: readonly BranchService[]) {
  const groups: { name: string | null; services: BranchService[] }[] = [];
  for (const service of services) {
    const last = groups.at(-1);
    if (last?.name === service.category.groupName) last.services.push(service);
    else groups.push({ name: service.category.groupName, services: [service] });
  }
  return groups;
}

function ServicesSection({ data, taxonomy }: Props) {
  const t = useTranslations('AdminServices');
  const tPrices = useTranslations('Prices');
  const prices = priceLabels(tPrices);
  // null: nothing open; 'new': the add form; a service id: that service's edit form.
  const [editing, setEditing] = useState<string | null>(null);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const speciesName = (id: string) => taxonomy.species.find((s) => s.id === id)?.name ?? id;
  const close = () => {
    setEditing(null);
  };

  return (
    <section aria-labelledby="services-heading" className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 id="services-heading" className="text-lg font-semibold">
          {t('servicesTitle')}
        </h2>
        <p className="text-sm text-muted-foreground">{t('servicesHint')}</p>
      </div>

      {data.services.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('noServices')}</p>
      ) : (
        byGroup(data.services).map((group) => (
          <div
            key={`${group.name ?? ''}-${String(group.services[0]?.id)}`}
            className="flex flex-col gap-2"
          >
            {group.name !== null && (
              <h3 className="text-sm font-medium text-muted-foreground">{group.name}</h3>
            )}
            <ul className="flex flex-col divide-y rounded-lg border">
              {group.services.map((service) =>
                editing === service.id ? (
                  <li key={service.id} className="p-3">
                    <ServiceForm
                      branchId={data.branchId}
                      service={service}
                      taxonomy={taxonomy}
                      defaultSpecies={data.speciesTreated}
                      onDone={close}
                    />
                  </li>
                ) : (
                  <li key={service.id} className="flex flex-col gap-2 p-3">
                    <div className="flex flex-wrap items-start gap-x-4 gap-y-1">
                      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span className="font-medium">{service.name}</span>
                        <span className="text-sm text-muted-foreground">
                          {service.category.name}
                          {service.speciesIds.length > 0 &&
                            ` · ${service.speciesIds.map(speciesName).join(', ')}`}
                        </span>
                      </div>
                      <div className="flex flex-col items-end gap-0.5 text-sm">
                        <span className="font-medium">{servicePriceLabel(service, prices)}</span>
                        {service.priceNote !== null && (
                          <span className="text-muted-foreground">{service.priceNote}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setEditing(service.id);
                        }}
                      >
                        <Pencil aria-hidden />
                        {t('edit')}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={pending}
                        onClick={() => {
                          setRemoveError(null);
                          startTransition(async () => {
                            const result = await deleteServiceAction(service.id);
                            if (result.status === 'error') setRemoveError(t('removeFailed'));
                          });
                        }}
                      >
                        <Trash2 aria-hidden />
                        {t('remove')}
                      </Button>
                      {data.otherBranches.length > 0 && <CopyToBranches serviceId={service.id} />}
                    </div>
                  </li>
                ),
              )}
            </ul>
          </div>
        ))
      )}
      {removeError !== null && (
        <p role="alert" className="text-sm text-destructive">
          {removeError}
        </p>
      )}

      {editing === 'new' ? (
        <div className="rounded-lg border p-3">
          <ServiceForm
            branchId={data.branchId}
            taxonomy={taxonomy}
            defaultSpecies={data.speciesTreated}
            onDone={close}
          />
        </div>
      ) : (
        <div>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setEditing('new');
            }}
          >
            <Plus aria-hidden />
            {t('addService')}
          </Button>
        </div>
      )}
    </section>
  );
}

/** One group of the copy confirmation: a title, then the branches as a bulleted list. */
function BranchList({
  title,
  branches,
  className,
}: {
  title: string;
  branches: CopyServiceResult['added'];
  className?: string;
}) {
  const t = useTranslations('AdminServices');
  const locale = useLocale();
  if (branches.length === 0) return null;
  const list = new Intl.ListFormat(locale, { type: 'conjunction' });
  return (
    <div className={className}>
      <p>{title}</p>
      <ul className="list-disc pl-5">
        {branches.map((branch) => (
          <li key={branch.id}>
            {branch.name}
            {branch.speciesAdded.length > 0 && (
              <span className="font-normal text-muted-foreground">
                {' — '}
                {t('copySpeciesAdded', { species: list.format(branch.speciesAdded) })}
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * "Copy to all branches": a dry run first, so the confirmation can say which branches get a
 * new copy and which have their same-named service replaced.
 */
function CopyToBranches({ serviceId }: { serviceId: string }) {
  const t = useTranslations('AdminServices');
  const [plan, setPlan] = useState<CopyServiceResult | null>(null);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const [pending, startTransition] = useTransition();

  function run(dryRun: boolean) {
    setMessage(null);
    startTransition(async () => {
      const { state, result } = await copyServiceAction(serviceId, dryRun);
      if (result === null) {
        setPlan(null);
        setMessage({ text: state.formError ?? t('copyFailed'), error: true });
        return;
      }
      if (dryRun) {
        setPlan(result);
      } else {
        setPlan(null);
        setMessage({ text: t('copyDone'), error: false });
      }
    });
  }

  if (plan === null) {
    return (
      <>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={pending}
          onClick={() => {
            run(true);
          }}
        >
          <Copy aria-hidden />
          {pending ? t('copyChecking') : t('copy')}
        </Button>
        {message !== null && (
          <p
            role={message.error ? 'alert' : 'status'}
            className={`self-center text-sm ${message.error ? 'text-destructive' : 'text-status-open'}`}
          >
            {message.text}
          </p>
        )}
      </>
    );
  }

  // An identical service can still bring species the branch doesn't treat yet.
  const nothingToDo =
    plan.added.length === 0 &&
    plan.updated.length === 0 &&
    plan.unchanged.every((branch) => branch.speciesAdded.length === 0);
  return (
    <div
      role="group"
      aria-label={t('copy')}
      className="flex w-full flex-col gap-2 rounded-md bg-muted p-3 text-sm"
    >
      {nothingToDo ? (
        <p>{t('copyNothing')}</p>
      ) : (
        <>
          <BranchList title={t('copyAdds')} branches={plan.added} />
          <BranchList title={t('copyUpdates')} branches={plan.updated} className="font-medium" />
          <BranchList
            title={t('copyUnchanged')}
            branches={plan.unchanged}
            className="text-muted-foreground"
          />
        </>
      )}
      <div className="flex gap-2">
        {!nothingToDo && (
          <Button
            type="button"
            size="sm"
            disabled={pending}
            onClick={() => {
              run(false);
            }}
          >
            {t('copyConfirm')}
          </Button>
        )}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            setPlan(null);
          }}
        >
          {t('cancel')}
        </Button>
      </div>
    </div>
  );
}

interface FormProps {
  branchId: string;
  /** The service being edited; omit to add one. */
  service?: BranchService;
  taxonomy: Taxonomy;
  /** New services start with the species the branch treats. */
  defaultSpecies: string[];
  onDone: () => void;
}

const pesosText = (centavos: number | null) => (centavos === null ? '' : formatPesos(centavos));

function ServiceForm({ branchId, service, taxonomy, defaultSpecies, onDone }: FormProps) {
  const t = useTranslations('AdminServices');
  const tForms = useTranslations('AdminForms');
  const tEnums = useTranslations('Enums');
  const [state, setState] = useState<FormState>(idleForm);
  const [pending, startTransition] = useTransition();

  const [categoryId, setCategoryId] = useState(service?.category.id ?? '');
  const [name, setName] = useState(service?.name ?? '');
  // A new service's name follows the service type until it's typed in.
  const [nameTouched, setNameTouched] = useState(service !== undefined);
  const [speciesIds, setSpeciesIds] = useState<string[]>(service?.speciesIds ?? defaultSpecies);
  const [priceMin, setPriceMin] = useState(pesosText(service?.priceMin ?? null));
  const [priceMax, setPriceMax] = useState(pesosText(service?.priceMax ?? null));
  const [priceUnit, setPriceUnit] = useState<PriceUnit>(service?.priceUnit ?? 'per_visit');
  const [priceNote, setPriceNote] = useState(service?.priceNote ?? '');
  const [description, setDescription] = useState(service?.description ?? '');

  const idPrefix = service === undefined ? 'new-service' : `service-${service.id}`;
  const categoryName = (id: string) =>
    taxonomy.categories.flatMap((group) => group.children).find((c) => c.id === id)?.name;

  function onSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const min = parsePesos(priceMin);
    const max = parsePesos(priceMax);
    const fieldErrors: Record<string, string> = {};
    if (categoryId === '') fieldErrors.categoryId = t('pickCategory');
    if (min === undefined) fieldErrors.priceMin = t('priceInvalid');
    if (max === undefined) fieldErrors.priceMax = t('priceInvalid');
    if (min === undefined || max === undefined || categoryId === '') {
      setState({ status: 'error', formError: null, fieldErrors });
      return;
    }

    const body = {
      categoryId,
      name,
      speciesIds,
      priceMin: min,
      priceMax: max,
      priceUnit,
      priceNote: priceNote.trim() === '' ? null : priceNote.trim(),
      description: description.trim() === '' ? null : description.trim(),
    };
    startTransition(async () => {
      const result =
        service === undefined
          ? await createServiceAction(branchId, body)
          : await updateServiceAction(service.id, body);
      setState(result);
      if (result.status === 'saved') onDone();
    });
  }

  const field = (key: string, hint?: string) => {
    const error = errorAt(state, key);
    return {
      id: `${idPrefix}-${key}`,
      'aria-invalid': error !== undefined,
      'aria-describedby': describedBy(`${idPrefix}-${key}`, hint, error),
    };
  };
  // Both price inputs share the one hint under them.
  const priceField = (key: 'priceMin' | 'priceMax') => {
    const error = errorAt(state, key);
    return {
      id: `${idPrefix}-${key}`,
      'aria-invalid': error !== undefined,
      'aria-describedby': [
        `${idPrefix}-price-hint`,
        error !== undefined && `${idPrefix}-${key}-error`,
      ]
        .filter(Boolean)
        .join(' '),
    };
  };

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-6">
        <FormField
          id={`${idPrefix}-categoryId`}
          label={t('category')}
          error={errorAt(state, 'categoryId')}
        >
          <NativeSelect
            {...field('categoryId')}
            value={categoryId}
            onChange={(event) => {
              setCategoryId(event.target.value);
              if (!nameTouched) setName(categoryName(event.target.value) ?? '');
            }}
          >
            <NativeSelectOption value="" disabled>
              {t('pickCategory')}
            </NativeSelectOption>
            {taxonomy.categories
              .filter((group) => group.children.length > 0)
              .map((group) => (
                <NativeSelectOptGroup key={group.id} label={group.name}>
                  {group.children.map((c) => (
                    <NativeSelectOption key={c.id} value={c.id}>
                      {c.name}
                    </NativeSelectOption>
                  ))}
                </NativeSelectOptGroup>
              ))}
          </NativeSelect>
        </FormField>

        <div className="min-w-64 flex-1">
          <FormField
            id={`${idPrefix}-name`}
            label={t('name')}
            hint={t('nameHint')}
            error={errorAt(state, 'name')}
          >
            <Input
              {...field('name', t('nameHint'))}
              maxLength={200}
              value={name}
              onChange={(event) => {
                setName(event.target.value);
                setNameTouched(true);
              }}
            />
          </FormField>
        </div>
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium">{t('species')}</legend>
        <p id={`${idPrefix}-species-hint`} className="text-sm text-muted-foreground">
          {defaultSpecies.length === 0 && service === undefined
            ? t('noSpeciesYet')
            : t('speciesServiceHint')}
        </p>
        <SpeciesCheckboxes
          idPrefix={`${idPrefix}-species`}
          species={taxonomy.species}
          selected={speciesIds}
          onChange={setSpeciesIds}
          invalid={errorAt(state, 'speciesIds') !== undefined}
          describedById={`${idPrefix}-species-hint`}
        />
        {errorAt(state, 'speciesIds') !== undefined && (
          <p className="text-sm text-destructive">{errorAt(state, 'speciesIds')}</p>
        )}
      </fieldset>

      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap gap-4">
          <FormField
            id={`${idPrefix}-priceMin`}
            label={t('priceMin')}
            labelSuffix={tForms('optional')}
            error={errorAt(state, 'priceMin')}
          >
            <Input
              {...priceField('priceMin')}
              className="w-36"
              inputMode="decimal"
              value={priceMin}
              onChange={(event) => {
                setPriceMin(event.target.value);
              }}
            />
          </FormField>
          <FormField
            id={`${idPrefix}-priceMax`}
            label={t('priceMax')}
            labelSuffix={tForms('optional')}
            error={errorAt(state, 'priceMax')}
          >
            <Input
              {...priceField('priceMax')}
              className="w-36"
              inputMode="decimal"
              value={priceMax}
              onChange={(event) => {
                setPriceMax(event.target.value);
              }}
            />
          </FormField>
          <FormField id={`${idPrefix}-priceUnit`} label={t('priceUnit')}>
            <NativeSelect
              {...field('priceUnit')}
              value={priceUnit}
              onChange={(event) => {
                const unit = PRICE_UNITS.find((u) => u === event.target.value);
                if (unit !== undefined) setPriceUnit(unit);
              }}
            >
              {PRICE_UNITS.map((unit) => (
                <NativeSelectOption key={unit} value={unit}>
                  {tEnums(`priceUnit.${unit}`)}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </FormField>
        </div>
        <p id={`${idPrefix}-price-hint`} className="text-sm text-muted-foreground">
          {t('priceHint')}
        </p>
      </div>

      <FormField
        id={`${idPrefix}-priceNote`}
        label={t('priceNote')}
        labelSuffix={tForms('optional')}
        error={errorAt(state, 'priceNote')}
      >
        <Input
          {...field('priceNote')}
          className="max-w-md"
          maxLength={200}
          placeholder={t('priceNotePlaceholder')}
          value={priceNote}
          onChange={(event) => {
            setPriceNote(event.target.value);
          }}
        />
      </FormField>

      <FormField
        id={`${idPrefix}-description`}
        label={t('description')}
        labelSuffix={tForms('optional')}
        error={errorAt(state, 'description')}
      >
        <Textarea
          {...field('description')}
          className="max-w-2xl"
          maxLength={2000}
          rows={2}
          value={description}
          onChange={(event) => {
            setDescription(event.target.value);
          }}
        />
      </FormField>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? tForms('saving') : t('saveService')}
        </Button>
        <Button type="button" variant="ghost" onClick={onDone}>
          {t('cancel')}
        </Button>
        <FormStatus
          formError={state.formError}
          hasFieldErrors={Object.keys(state.fieldErrors).length > 0}
          saved={false}
          fixErrorsLabel={tForms('fixErrors')}
          savedLabel={tForms('saved')}
        />
      </div>
    </form>
  );
}

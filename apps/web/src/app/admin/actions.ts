'use server';

// Server Actions for /admin forms. Each one: (1) checks the session with requireAdmin()
// (actions are public POST endpoints, reachable without the UI), (2) calls the API as the
// signed-in user, which validates the input and checks the role again, (3) redirects or
// refreshes on success, or returns the API's errors for the form to show.

import { toManila } from '@paw/domain';
import { refresh } from 'next/cache';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { z } from 'zod';
import { adminApi } from '@/lib/admin-api';
import { requireAdmin } from '@/lib/admin-session';
import type {
  CopyServiceResult,
  CreateBranchBody,
  CreateBusinessBody,
  CreateProductBody,
  CreateServiceBody,
  ReplaceHoursBody,
  SetHoursExceptionBody,
  UpdateBranchBody,
  UpdateBusinessBody,
  UpdateProductBody,
  UpdateServiceBody,
} from '@/lib/admin-types';
import { formStateFromProblem, savedForm, type FormState } from '@/lib/form-errors';

// Ids and dates arrive from the browser like any other input; check them before they go in a URL.
const IdSchema = z.uuid();
const DateSchema = z.iso.date();

async function failed(error: unknown): Promise<FormState> {
  const t = await getTranslations('AdminForms');
  return formStateFromProblem(error, t('saveFailed'));
}

async function checkedId(id: unknown): Promise<string | FormState> {
  const parsed = IdSchema.safeParse(id);
  return parsed.success ? parsed.data : failed(undefined);
}

export async function createBusinessAction(body: CreateBusinessBody): Promise<FormState> {
  await requireAdmin();
  const api = await adminApi();
  const { data, error } = await api.POST('/v1/admin/businesses', { body });
  if (data === undefined) return failed(error);
  redirect(`/admin/businesses/${data.id}`);
}

export async function updateBusinessAction(
  businessId: string,
  body: UpdateBusinessBody,
): Promise<FormState> {
  await requireAdmin();
  const id = await checkedId(businessId);
  if (typeof id !== 'string') return id;

  const api = await adminApi();
  const { data, error } = await api.PATCH('/v1/admin/businesses/{id}', {
    params: { path: { id } },
    body,
  });
  if (data === undefined) return failed(error);
  // Re-renders the current page with the saved data (names in the header, history, …).
  refresh();
  return savedForm;
}

export async function createBranchAction(
  businessId: string,
  body: CreateBranchBody,
): Promise<FormState> {
  await requireAdmin();
  const id = await checkedId(businessId);
  if (typeof id !== 'string') return id;

  const api = await adminApi();
  const { data, error } = await api.POST('/v1/admin/businesses/{id}/branches', {
    params: { path: { id } },
    body,
  });
  if (data === undefined) return failed(error);
  redirect(`/admin/businesses/${id}/branches/${data.id}`);
}

export async function updateBranchAction(
  branchId: string,
  body: UpdateBranchBody,
): Promise<FormState> {
  await requireAdmin();
  const id = await checkedId(branchId);
  if (typeof id !== 'string') return id;

  const api = await adminApi();
  const { data, error } = await api.PATCH('/v1/admin/branches/{id}', {
    params: { path: { id } },
    body,
  });
  if (data === undefined) return failed(error);
  refresh();
  return savedForm;
}

// ── Hours (ARCHITECTURE D35) ────────────────────────────────────────────────────────────

export async function updateHoursAction(
  branchId: string,
  body: ReplaceHoursBody,
): Promise<FormState> {
  await requireAdmin();
  const id = await checkedId(branchId);
  if (typeof id !== 'string') return id;

  const api = await adminApi();
  const { data, error } = await api.PUT('/v1/admin/branches/{id}/hours', {
    params: { path: { id } },
    body,
  });
  if (data === undefined) return failed(error);
  refresh();
  return savedForm;
}

export async function setHoursExceptionAction(
  branchId: string,
  date: string,
  body: SetHoursExceptionBody,
): Promise<FormState> {
  await requireAdmin();
  const id = await checkedId(branchId);
  if (typeof id !== 'string') return id;
  const parsedDate = DateSchema.safeParse(date);
  if (!parsedDate.success) {
    const t = await getTranslations('AdminHours');
    return { status: 'error', formError: null, fieldErrors: { date: t('pickDate') } };
  }

  const api = await adminApi();
  const { data, error } = await api.PUT('/v1/admin/branches/{id}/hours-exceptions/{date}', {
    params: { path: { id, date: parsedDate.data } },
    body,
  });
  if (data === undefined) return failed(error);
  refresh();
  return savedForm;
}

/** "Closed today": today is the Manila date on the server when the button is pressed. */
export async function closedTodayAction(branchId: string, note: string): Promise<FormState> {
  await requireAdmin();
  return setHoursExceptionAction(branchId, toManila(new Date()).date, {
    isClosed: true,
    intervals: [],
    note: note.trim() === '' ? null : note.trim(),
  });
}

export async function deleteHoursExceptionAction(
  branchId: string,
  date: string,
): Promise<FormState> {
  await requireAdmin();
  const id = await checkedId(branchId);
  if (typeof id !== 'string') return id;
  const parsedDate = DateSchema.safeParse(date);
  if (!parsedDate.success) return failed(undefined);

  const api = await adminApi();
  const { data, error } = await api.DELETE('/v1/admin/branches/{id}/hours-exceptions/{date}', {
    params: { path: { id, date: parsedDate.data } },
  });
  if (data === undefined) return failed(error);
  refresh();
  return savedForm;
}

export async function confirmHoursAction(branchId: string): Promise<FormState> {
  await requireAdmin();
  const id = await checkedId(branchId);
  if (typeof id !== 'string') return id;

  const api = await adminApi();
  const { data, error } = await api.POST('/v1/admin/branches/{id}/hours/confirm', {
    params: { path: { id } },
  });
  if (data === undefined) return failed(error);
  refresh();
  return savedForm;
}

// ── Services and species treated (ARCHITECTURE D36, D37) ────────────────────────────────
// Deletes answer 204 No Content, so they check `response.ok` instead of `data`.

export async function setSpeciesTreatedAction(
  branchId: string,
  speciesIds: string[],
): Promise<FormState> {
  await requireAdmin();
  const id = await checkedId(branchId);
  if (typeof id !== 'string') return id;

  const api = await adminApi();
  const { data, error } = await api.PUT('/v1/admin/branches/{id}/species', {
    params: { path: { id } },
    body: { speciesIds },
  });
  if (data === undefined) return failed(error);
  refresh();
  return savedForm;
}

export async function createServiceAction(
  branchId: string,
  body: CreateServiceBody,
): Promise<FormState> {
  await requireAdmin();
  const id = await checkedId(branchId);
  if (typeof id !== 'string') return id;

  const api = await adminApi();
  const { data, error } = await api.POST('/v1/admin/branches/{id}/services', {
    params: { path: { id } },
    body,
  });
  if (data === undefined) return failed(error);
  refresh();
  return savedForm;
}

export async function updateServiceAction(
  serviceId: string,
  body: UpdateServiceBody,
): Promise<FormState> {
  await requireAdmin();
  const id = await checkedId(serviceId);
  if (typeof id !== 'string') return id;

  const api = await adminApi();
  const { data, error } = await api.PATCH('/v1/admin/services/{id}', {
    params: { path: { id } },
    body,
  });
  if (data === undefined) return failed(error);
  refresh();
  return savedForm;
}

export async function deleteServiceAction(serviceId: string): Promise<FormState> {
  await requireAdmin();
  const id = await checkedId(serviceId);
  if (typeof id !== 'string') return id;

  const api = await adminApi();
  const { error, response } = await api.DELETE('/v1/admin/services/{id}', {
    params: { path: { id } },
  });
  if (!response.ok) return failed(error);
  refresh();
  return savedForm;
}

/** With `dryRun`, only reports which branches would get the service added or updated. */
export async function copyServiceAction(
  serviceId: string,
  dryRun: boolean,
): Promise<{ state: FormState; result: CopyServiceResult | null }> {
  await requireAdmin();
  const id = await checkedId(serviceId);
  if (typeof id !== 'string') return { state: id, result: null };

  const api = await adminApi();
  const { data, error } = await api.POST('/v1/admin/services/{id}/copy-to-branches', {
    params: { path: { id } },
    body: { dryRun },
  });
  if (data === undefined) return { state: await failed(error), result: null };
  if (!dryRun) refresh();
  return { state: savedForm, result: data };
}

// ── Products ────────────────────────────────────────────────────────────────────────────

export async function createProductAction(
  businessId: string,
  body: CreateProductBody,
): Promise<FormState> {
  await requireAdmin();
  const id = await checkedId(businessId);
  if (typeof id !== 'string') return id;

  const api = await adminApi();
  const { data, error } = await api.POST('/v1/admin/businesses/{id}/products', {
    params: { path: { id } },
    body,
  });
  if (data === undefined) return failed(error);
  refresh();
  return savedForm;
}

export async function updateProductAction(
  productId: string,
  body: UpdateProductBody,
): Promise<FormState> {
  await requireAdmin();
  const id = await checkedId(productId);
  if (typeof id !== 'string') return id;

  const api = await adminApi();
  const { data, error } = await api.PATCH('/v1/admin/products/{id}', {
    params: { path: { id } },
    body,
  });
  if (data === undefined) return failed(error);
  refresh();
  return savedForm;
}

export async function deleteProductAction(productId: string): Promise<FormState> {
  await requireAdmin();
  const id = await checkedId(productId);
  if (typeof id !== 'string') return id;

  const api = await adminApi();
  const { error, response } = await api.DELETE('/v1/admin/products/{id}', {
    params: { path: { id } },
  });
  if (!response.ok) return failed(error);
  refresh();
  return savedForm;
}

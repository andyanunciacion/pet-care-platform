'use server';

// Server Actions for /admin forms. Each one: (1) checks the session with requireAdmin()
// (actions are public POST endpoints, reachable without the UI), (2) calls the API as the
// signed-in user, which validates the input and checks the role again, (3) redirects or
// refreshes on success, or returns the API's errors for the form to show.

import { refresh } from 'next/cache';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { z } from 'zod';
import { adminApi } from '@/lib/admin-api';
import { requireAdmin } from '@/lib/admin-session';
import type {
  CreateBranchBody,
  CreateBusinessBody,
  UpdateBranchBody,
  UpdateBusinessBody,
} from '@/lib/admin-types';
import { formStateFromProblem, savedForm, type FormState } from '@/lib/form-errors';

// Ids arrive from the browser like any other input; check them before they go in a URL.
const IdSchema = z.uuid();

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

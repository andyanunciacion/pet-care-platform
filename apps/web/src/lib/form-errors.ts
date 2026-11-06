import { z } from 'zod';

/**
 * What a Server Action tells its form. Field errors are keyed by dotted path
 * ("slug", "contacts.1.value"), matching the API's JSON Pointers ("/contacts/1/value").
 */
export interface FormState {
  status: 'idle' | 'saved' | 'error';
  /** A message for the whole form (e.g. "Couldn't save"), when no field is to blame. */
  formError: string | null;
  fieldErrors: Record<string, string>;
}

export const idleForm: FormState = { status: 'idle', formError: null, fieldErrors: {} };
export const savedForm: FormState = { status: 'saved', formError: null, fieldErrors: {} };

// The API's RFC 9457 problem body (apps/api/src/errors.ts).
const ProblemSchema = z.object({
  detail: z.string().optional(),
  errors: z.array(z.object({ pointer: z.string(), message: z.string() })).optional(),
});

/** "/contacts/1/value" → "contacts.1.value"; "" (the whole body) → "". */
export function pointerToPath(pointer: string): string {
  return pointer.split('/').filter(Boolean).join('.');
}

/** Turns an API error response body into form state; `fallback` covers outages. */
export function formStateFromProblem(body: unknown, fallback: string): FormState {
  const problem = ProblemSchema.safeParse(body);
  if (!problem.success) return { status: 'error', formError: fallback, fieldErrors: {} };

  const fieldErrors: Record<string, string> = {};
  let formError: string | null = null;
  for (const { pointer, message } of problem.data.errors ?? []) {
    const path = pointerToPath(pointer);
    if (path === '') formError ??= message;
    // The first message per field is the most useful one; the rest repeat it.
    else fieldErrors[path] ??= message;
  }
  if (Object.keys(fieldErrors).length === 0) formError ??= problem.data.detail ?? fallback;
  return { status: 'error', formError, fieldErrors };
}

/** The error for a field or anything inside it ("location" also matches "location.lat"). */
export function errorAt(state: FormState, path: string): string | undefined {
  if (state.fieldErrors[path] !== undefined) return state.fieldErrors[path];
  const nested = Object.keys(state.fieldErrors).find((key) => key.startsWith(`${path}.`));
  return nested === undefined ? undefined : state.fieldErrors[nested];
}

import { describe, expect, it } from 'vitest';
import { errorAt, formStateFromProblem, pointerToPath } from './form-errors';

describe('pointerToPath', () => {
  it.each([
    ['/slug', 'slug'],
    ['/contacts/1/value', 'contacts.1.value'],
    ['', ''],
  ])('%j → %j', (pointer, path) => {
    expect(pointerToPath(pointer)).toBe(path);
  });
});

describe('formStateFromProblem', () => {
  it('puts field errors next to their fields', () => {
    const state = formStateFromProblem(
      {
        status: 400,
        detail: 'The request is invalid.',
        errors: [
          { location: 'body', pointer: '/slug', message: 'Taken' },
          { location: 'body', pointer: '/contacts/0/value', message: 'Bad number' },
          { location: 'body', pointer: '/slug', message: 'Second slug message' },
        ],
      },
      'Fallback',
    );
    expect(state).toEqual({
      status: 'error',
      formError: null,
      fieldErrors: { slug: 'Taken', 'contacts.0.value': 'Bad number' },
    });
  });

  it("uses the problem's detail when no field is to blame", () => {
    expect(formStateFromProblem({ status: 404, detail: 'No business' }, 'Fallback')).toMatchObject({
      formError: 'No business',
      fieldErrors: {},
    });
  });

  it('falls back when the body is not a problem (e.g. an outage)', () => {
    expect(formStateFromProblem(undefined, 'Fallback').formError).toBe('Fallback');
    expect(formStateFromProblem('<html>', 'Fallback').formError).toBe('Fallback');
  });
});

describe('errorAt', () => {
  const state = formStateFromProblem(
    { errors: [{ pointer: '/location/lat', message: 'Too big' }] },
    'Fallback',
  );

  it('finds errors on nested fields', () => {
    expect(errorAt(state, 'location')).toBe('Too big');
    expect(errorAt(state, 'name')).toBeUndefined();
  });
});

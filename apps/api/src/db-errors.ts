/**
 * True when a query failed because it broke this unique constraint (Postgres error 23505).
 * Catching the violation, instead of checking first, is race-free: two saves at the same
 * moment can't both pass a "slug is free" check.
 */
export function isUniqueViolation(error: unknown, constraint: string): boolean {
  // Drizzle wraps the driver's error; the Postgres details are on `cause`.
  const pgError: unknown =
    error instanceof Error && error.cause !== undefined ? error.cause : error;
  return (
    typeof pgError === 'object' &&
    pgError !== null &&
    'code' in pgError &&
    pgError.code === '23505' &&
    'constraint' in pgError &&
    pgError.constraint === constraint
  );
}

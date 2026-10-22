const UNIQUE_VIOLATION_CODE = '23505';
const FOREIGN_KEY_VIOLATION_CODE = '23503';

function causeOf(error: unknown): object | null {
  if (typeof error !== 'object' || error === null) return null;
  const cause: unknown = Reflect.get(error, 'cause');

  return typeof cause === 'object' && cause !== null ? cause : null;
}

/** Drizzle wraps driver errors in `DrizzleQueryError`; the Postgres fields live in `.cause`. */
export function isUniqueViolation(error: unknown, constraint: string): boolean {
  const cause = causeOf(error);
  if (!cause) return false;

  return (
    Reflect.get(cause, 'code') === UNIQUE_VIOLATION_CODE &&
    Reflect.get(cause, 'constraint_name') === constraint
  );
}

export function isForeignKeyViolation(
  error: unknown,
  constraint?: string,
): boolean {
  const cause = causeOf(error);
  if (!cause) return false;
  if (Reflect.get(cause, 'code') !== FOREIGN_KEY_VIOLATION_CODE) return false;

  return (
    constraint === undefined ||
    Reflect.get(cause, 'constraint_name') === constraint
  );
}

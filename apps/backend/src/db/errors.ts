// Small Postgres error utilities. Detects PG-specific failure modes by SQLSTATE.
// 23505 = unique_violation. https://www.postgresql.org/docs/current/errcodes-appendix.html

/**
 * True if `err` is a Postgres unique-constraint violation.
 * Optional `constraint` narrows to a specific named constraint
 * (the `external_identities_provider_sub_unique` index, etc.).
 */
export function isUniqueViolation(err: unknown, constraint?: string): boolean {
  if (typeof err !== 'object' || err === null) return false;
  const e = err as { code?: unknown; constraint_name?: unknown; constraint?: unknown };
  if (e.code !== '23505') return false;
  if (!constraint) return true;
  return e.constraint_name === constraint || e.constraint === constraint;
}

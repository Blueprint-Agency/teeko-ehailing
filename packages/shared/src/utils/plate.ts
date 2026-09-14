// utils/plate.ts
// One plate-number vocabulary for the portal form and every backend write.
//
// `vehicles.plate_number` is globally unique, so 'WKK 1234', 'WKK1234' and
// 'wkk 1234' must collapse to one stored value or the index is meaningless.
// Canonical form: uppercase, digits and letters only — the way JPJ prints it
// on the registration card.

/** Canonical Malaysian plate: 1–3 letter prefix, 1–4 digits, optional 1–2 letter suffix. */
export const PLATE_RE = /^[A-Z]{1,3}\d{1,4}[A-Z]{0,2}$/;

/** 'wkk 1234' / 'WKK-1234' / ' WKK 1234 ' → 'WKK1234'. Never throws; callers validate. */
export function normalisePlate(input: string | null | undefined): string {
  return (input ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export function isValidPlate(input: string | null | undefined): boolean {
  return PLATE_RE.test(normalisePlate(input));
}

/** Canonical → display: 'WKK1234' → 'WKK 1234', 'VAA1234A' → 'VAA 1234 A'. */
export function formatPlate(plate: string | null | undefined): string {
  const canonical = normalisePlate(plate);
  const m = canonical.match(/^([A-Z]{1,3})(\d{1,4})([A-Z]{0,2})$/);
  if (!m) return plate ?? '';
  return [m[1], m[2], m[3]].filter(Boolean).join(' ');
}

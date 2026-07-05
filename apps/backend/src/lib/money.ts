// Centralized money conversion. Ledger + Stripe calls are integer sen (cents);
// human-facing ringgit is a decimal. Never multiply by 100 inline — go through
// here so rounding is consistent (spec §4).

/** Ringgit → integer sen. `18.50` → `1850`. */
export function toCents(rm: number): number {
  return Math.round(rm * 100);
}

/** Integer sen → ringgit number. `1850` → `18.5`. */
export function fromCents(cents: number): number {
  return cents / 100;
}

/** Integer sen → display string. `1850` → `"RM 18.50"`. */
export function formatRm(cents: number): string {
  return `RM ${(cents / 100).toFixed(2)}`;
}

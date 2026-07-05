// Commission policy — centralized so the rate can vary by ride type / city /
// promo without touching the charge code (spec §13). The split is derived so
// the parts always sum to the whole: net = amount − commission, never both
// rounded independently.

import { env } from '../../config/env';

export type CommissionContext = {
  category?: string | null;
  city?: string | null;
};

/**
 * Resolve the commission rate for a trip. Today this is the flat
 * `COMMISSION_RATE`; the signature leaves room for per-category / per-city
 * overrides (a config table or map) without changing callers.
 */
export function getCommissionRate(_ctx: CommissionContext = {}): number {
  return env.COMMISSION_RATE;
}

export function computeCommission(
  amountCents: number,
  ctx: CommissionContext = {},
): { commissionCents: number; netCents: number } {
  const rate = getCommissionRate(ctx);
  const commissionCents = Math.round(amountCents * rate);
  return { commissionCents, netCents: amountCents - commissionCents };
}

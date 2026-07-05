// client/payments.ts
// Real-fetch client for the rider payment-methods API
// (apps/backend/src/api/rider/payments.routes.ts).
//
// The backend returns a PaymentMethodView ({ type, label|null, isDefault });
// we map it to the app's PaymentMethod domain shape ({ kind, label, isDefault })
// here so stores and components stay decoupled from the wire format. This module
// is the single seam where the wire contract meets the app.

import type { PaymentKind, PaymentMethod } from '@teeko/shared';

import { api } from './_fetch';

/** Wire shape returned by the backend (payments.routes.ts / service.ts:PaymentMethodView). */
interface PaymentMethodWire {
  id: string;
  type: PaymentKind;
  label: string | null;
  isDefault: boolean;
}

/** Fallback labels when the backend sends a null label (e.g. cash). */
const DEFAULT_LABEL: Record<PaymentKind, string> = {
  cash: 'Cash',
  card: 'Card',
  tng: "Touch 'n Go eWallet",
  google_pay: 'Google Pay',
};

function toPaymentMethod(w: PaymentMethodWire): PaymentMethod {
  return {
    id: w.id,
    kind: w.type,
    label: w.label ?? DEFAULT_LABEL[w.type],
    isDefault: w.isDefault,
  };
}

export async function listPaymentMethods(): Promise<PaymentMethod[]> {
  const rows = await api<PaymentMethodWire[]>('/api/v1/rider/payments');
  return rows.map(toPaymentMethod);
}

/**
 * Add a saved payment method. Card/Google Pay tokenization happens on-device
 * (Stripe SDK) and yields `token` (pm_xxx); TNG passes an agreement id; cash
 * needs no token.
 */
export async function addMethod(
  type: PaymentKind,
  token?: string,
): Promise<PaymentMethod> {
  const row = await api<PaymentMethodWire>('/api/v1/rider/payments', {
    method: 'POST',
    body: JSON.stringify({ type, ...(token ? { token } : {}) }),
  });
  return toPaymentMethod(row);
}

/** Set the rider's default method. Backend echoes the full updated list. */
export async function setDefaultPayment(id: string): Promise<PaymentMethod[]> {
  const rows = await api<PaymentMethodWire[]>(
    `/api/v1/rider/payments/${encodeURIComponent(id)}/default`,
    { method: 'POST' },
  );
  return rows.map(toPaymentMethod);
}

/** Detach + soft-delete a saved method (backend returns 204). */
export async function deleteMethod(id: string): Promise<void> {
  await api<void>(`/api/v1/rider/payments/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

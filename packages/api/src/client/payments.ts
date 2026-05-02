// client/payments.ts
// Real-fetch shadow of mock/handlers/payments.ts. Surface matches what
// stores/payments-store.ts imports so F1 can swap atomically.
// Backend endpoints not implemented yet — these will 404 until rider
// payments routes ship.

import type { PaymentMethod } from '@teeko/shared';

import { api } from './_fetch';

export async function listPaymentMethods(): Promise<PaymentMethod[]> {
  return api<PaymentMethod[]>('/api/v1/rider/payments');
}

export async function setDefaultPayment(id: string): Promise<PaymentMethod[]> {
  return api<PaymentMethod[]>(
    `/api/v1/rider/payments/${encodeURIComponent(id)}/default`,
    { method: 'POST' },
  );
}

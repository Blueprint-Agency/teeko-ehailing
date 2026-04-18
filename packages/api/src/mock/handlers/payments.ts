import type { PaymentMethod } from '@teeko/shared';

import { simulateLatency } from '../delay';
import paymentsJson from '../data/payment-methods.json';

const methods = paymentsJson as PaymentMethod[];

export async function listPaymentMethods(): Promise<PaymentMethod[]> {
  await simulateLatency(200, 500);
  return methods.map((m) => ({ ...m }));
}

export async function setDefaultPayment(id: string): Promise<PaymentMethod[]> {
  await simulateLatency(200, 500);
  return methods.map((m) => ({ ...m, isDefault: m.id === id }));
}

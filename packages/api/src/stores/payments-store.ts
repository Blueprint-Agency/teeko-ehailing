import type { PaymentMethod } from '@teeko/shared';
import { create } from 'zustand';

import * as paymentsApi from '../mock/handlers/payments';

export type PaymentsState = {
  methods: PaymentMethod[];
  defaultId: string | null;
  load: () => Promise<void>;
  setDefault: (id: string) => Promise<void>;
};

export const usePaymentsStore = create<PaymentsState>((set) => ({
  methods: [],
  defaultId: null,
  async load() {
    const methods = await paymentsApi.listPaymentMethods();
    set({ methods, defaultId: methods.find((m) => m.isDefault)?.id ?? methods[0]?.id ?? null });
  },
  async setDefault(id) {
    const methods = await paymentsApi.setDefaultPayment(id);
    set({ methods, defaultId: id });
  },
}));

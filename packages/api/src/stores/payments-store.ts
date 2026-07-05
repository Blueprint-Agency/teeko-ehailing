import type { PaymentKind, PaymentMethod } from '@teeko/shared';
import { create } from 'zustand';

import * as paymentsApi from '../client/payments';

export type PaymentsState = {
  methods: PaymentMethod[];
  defaultId: string | null;
  load: () => Promise<void>;
  setDefault: (id: string) => Promise<void>;
  add: (type: PaymentKind, token?: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
};

export const usePaymentsStore = create<PaymentsState>((set, get) => ({
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
  // Add + remove re-read the list so the (possibly server-changed) default
  // flag stays authoritative — e.g. the first method added becomes default.
  async add(type, token) {
    await paymentsApi.addMethod(type, token);
    await get().load();
  },
  async remove(id) {
    await paymentsApi.deleteMethod(id);
    await get().load();
  },
}));

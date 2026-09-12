import type { CreateSupportTicketInput, SupportTicket } from '@teeko/shared';
import { create } from 'zustand';

import * as supportApi from '../client/support';

export type SupportState = {
  // Every support ticket the rider has raised — the "My tickets" screen reads this.
  all: SupportTicket[];
  allLoading: boolean;
  submitting: boolean;
  error: string | null;
  loadAll: () => Promise<void>;
  submit: (input: CreateSupportTicketInput) => Promise<SupportTicket | null>;
};

export const useSupportStore = create<SupportState>((set) => ({
  all: [],
  allLoading: false,
  submitting: false,
  error: null,

  async loadAll() {
    set({ allLoading: true, error: null });
    try {
      const list = await supportApi.listAll();
      set({ all: list, allLoading: false });
    } catch (e) {
      set({ allLoading: false, error: (e as Error).message });
    }
  },

  async submit(input) {
    set({ submitting: true, error: null });
    try {
      const ticket = await supportApi.create(input);
      // Prepend so a freshly raised ticket shows immediately without a refetch.
      set((s) => ({ submitting: false, all: [ticket, ...s.all] }));
      return ticket;
    } catch (e) {
      set({ submitting: false, error: (e as Error).message });
      return null;
    }
  },
}));

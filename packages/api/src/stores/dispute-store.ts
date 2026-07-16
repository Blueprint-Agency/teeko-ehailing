import type { CreateDisputeInput, RiderDispute } from '@teeko/shared';
import { create } from 'zustand';

import * as disputesApi from '../client/disputes';

export type DisputeState = {
  // Disputes keyed by tripId — the receipt screen reads its trip's list.
  byTrip: Record<string, RiderDispute[]>;
  loading: boolean;
  submitting: boolean;
  error: string | null;
  loadForTrip: (tripId: string) => Promise<void>;
  submit: (input: CreateDisputeInput) => Promise<RiderDispute | null>;
};

export const useDisputeStore = create<DisputeState>((set, get) => ({
  byTrip: {},
  loading: false,
  submitting: false,
  error: null,

  async loadForTrip(tripId) {
    set({ loading: true, error: null });
    try {
      const list = await disputesApi.listForTrip(tripId);
      set((s) => ({ byTrip: { ...s.byTrip, [tripId]: list }, loading: false }));
    } catch (e) {
      set({ loading: false, error: (e as Error).message });
    }
  },

  async submit(input) {
    set({ submitting: true, error: null });
    try {
      const dispute = await disputesApi.create(input);
      set((s) => ({
        submitting: false,
        byTrip: {
          ...s.byTrip,
          [input.tripId]: [dispute, ...(s.byTrip[input.tripId] ?? [])],
        },
      }));
      return dispute;
    } catch (e) {
      set({ submitting: false, error: (e as Error).message });
      return null;
    }
  },
}));

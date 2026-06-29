'use client';
import { create } from 'zustand';
import { adminApi, type Rider } from '@/lib/api';

export type { Rider };

interface RiderState {
  riders: Rider[];
  loading: boolean;
  loaded: boolean;
  error: string;
  selectedRiderId: string | null;
  loadRiders: (force?: boolean) => Promise<void>;
  selectRider: (id: string | null) => void;
  updateRiderStatus: (id: string, status: string) => void;
}

export const useRiderStore = create<RiderState>()((set, get) => ({
  riders: [],
  loading: false,
  loaded: false,
  error: '',
  selectedRiderId: null,
  loadRiders: async (force = false) => {
    if (get().loading) return;
    if (get().loaded && !force) return;
    set({ loading: true, error: '' });
    try {
      const riders = await adminApi.getRiders();
      set({ riders, loaded: true });
    } catch (e) {
      set({ error: e instanceof Error ? e.message : 'Failed to load riders' });
    } finally {
      set({ loading: false });
    }
  },
  selectRider: (id) => set({ selectedRiderId: id }),
  updateRiderStatus: (id, status) =>
    set((s) => ({
      riders: s.riders.map((r) => (r.id === id ? { ...r, status } : r)),
    })),
}));

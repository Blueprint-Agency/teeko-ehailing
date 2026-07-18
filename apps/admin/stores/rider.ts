'use client';
import { create } from 'zustand';
import { adminApi, type NewRider, type Rider } from '@/lib/api';

export type { NewRider, Rider };

interface RiderState {
  riders: Rider[];
  loading: boolean;
  loaded: boolean;
  error: string;
  selectedRiderId: string | null;
  loadRiders: (force?: boolean) => Promise<void>;
  selectRider: (id: string | null) => void;
  updateRiderStatus: (id: string, status: string) => void;
  createRider: (input: NewRider) => Promise<void>;
  deleteRider: (id: string) => Promise<void>;
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
  createRider: async (input) => {
    const rider = await adminApi.createRider(input);
    set((s) => ({ riders: [rider, ...s.riders] }));
  },
  deleteRider: async (id) => {
    await adminApi.deleteRider(id);
    set((s) => ({ riders: s.riders.filter((r) => r.id !== id) }));
  },
}));

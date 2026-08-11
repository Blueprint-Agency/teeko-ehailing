'use client';
import { create } from 'zustand';
import { adminApi, type Trip } from '@/lib/api';

export type { Trip };

interface TripState {
  trips: Trip[];
  loading: boolean;
  loaded: boolean;
  error: string;
  selectedTripId: string | null;
  loadTrips: (force?: boolean) => Promise<void>;
  selectTrip: (id: string | null) => void;
}

export const useTripStore = create<TripState>()((set, get) => ({
  trips: [],
  loading: false,
  loaded: false,
  error: '',
  selectedTripId: null,
  loadTrips: async (force = false) => {
    if (get().loading) return;
    if (get().loaded && !force) return;
    set({ loading: true, error: '' });
    try {
      const trips = await adminApi.getTrips();
      set({ trips, loaded: true });
    } catch (e) {
      set({ error: e instanceof Error ? e.message : 'Failed to load trips' });
    } finally {
      set({ loading: false });
    }
  },
  selectTrip: (id) => set({ selectedTripId: id }),
}));

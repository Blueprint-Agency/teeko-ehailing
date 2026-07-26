'use client';
import { create } from 'zustand';
import { adminApi, type Driver, type DriverStatus } from '@/lib/api';

export type { Driver, DriverStatus };

interface DriverState {
  drivers: Driver[];
  loading: boolean;
  loaded: boolean;
  error: string;
  selectedDriverId: string | null;
  loadDrivers: (force?: boolean) => Promise<void>;
  selectDriver: (id: string | null) => void;
  updateDriverStatus: (id: string, status: DriverStatus, reason?: string) => Promise<void>;
}

export const useDriverStore = create<DriverState>()((set, get) => ({
  drivers: [],
  loading: false,
  loaded: false,
  error: '',
  selectedDriverId: null,
  loadDrivers: async (force = false) => {
    if (get().loading) return;
    if (get().loaded && !force) return;
    set({ loading: true, error: '' });
    try {
      const drivers = await adminApi.getDrivers();
      set({ drivers, loaded: true });
    } catch (e) {
      set({ error: e instanceof Error ? e.message : 'Failed to load drivers' });
    } finally {
      set({ loading: false });
    }
  },
  selectDriver: (id) => set({ selectedDriverId: id }),
  updateDriverStatus: async (id, status, reason) => {
    await adminApi.updateDriverStatus(id, status, reason);
    set((s) => ({
      drivers: s.drivers.map((d) => (d.id === id ? { ...d, status } : d)),
    }));
  },
}));

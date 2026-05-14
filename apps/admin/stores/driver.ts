'use client';
import { create } from 'zustand';
import driversData from '@/data/mock-drivers.json';

export interface Driver {
  id: string; name: string; ic: string; phone: string; email: string;
  city: string; category: string; status: string; evp: string;
  rating: number; trips: number; joinDate: string; vehicle: string;
  plate: string; earnings: number;
}

interface DriverState {
  drivers: Driver[];
  selectedDriverId: string | null;
  selectDriver: (id: string | null) => void;
  updateDriverStatus: (id: string, status: string) => void;
}

export const useDriverStore = create<DriverState>()((set) => ({
  drivers: driversData as Driver[],
  selectedDriverId: null,
  selectDriver: (id) => set({ selectedDriverId: id }),
  updateDriverStatus: (id, status) =>
    set((s) => ({
      drivers: s.drivers.map((d) => (d.id === id ? { ...d, status } : d)),
    })),
}));

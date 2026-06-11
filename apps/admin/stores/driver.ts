'use client';
import { create } from 'zustand';
import driversData from '@/data/mock-drivers.json';

export interface Driver {
  id: string; name: string; ic: string; phone: string; email: string;
  city: string; category: string; status: string; evp: string;
  account: 'open' | 'closed';
  rating: number; trips: number; joinDate: string; vehicle: string;
  plate: string; earnings: number;
}

interface DriverState {
  drivers: Driver[];
  selectedDriverId: string | null;
  selectDriver: (id: string | null) => void;
  updateDriverStatus: (id: string, status: string) => void;
  updateDriverEvp: (id: string, evp: string) => void;
  openDriverAccount: (id: string) => void;
}

const initialDrivers: Driver[] = (driversData as Omit<Driver, 'account'>[]).map((d) => ({
  ...d,
  account: 'closed',
}));

export const useDriverStore = create<DriverState>()((set) => ({
  drivers: initialDrivers,
  selectedDriverId: null,
  selectDriver: (id) => set({ selectedDriverId: id }),
  updateDriverStatus: (id, status) =>
    set((s) => ({
      drivers: s.drivers.map((d) => (d.id === id ? { ...d, status } : d)),
    })),
  updateDriverEvp: (id, evp) =>
    set((s) => ({
      drivers: s.drivers.map((d) => (d.id === id ? { ...d, evp } : d)),
    })),
  // Final onboarding step after document upload + EVP approval.
  // Only drivers with an approved EVP can have their account opened.
  openDriverAccount: (id) =>
    set((s) => ({
      drivers: s.drivers.map((d) =>
        d.id === id && d.evp === 'approved' ? { ...d, account: 'open' } : d
      ),
    })),
}));

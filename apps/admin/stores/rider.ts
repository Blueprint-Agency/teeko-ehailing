'use client';
import { create } from 'zustand';
import ridersData from '@/data/mock-riders.json';

export interface Rider {
  id: string; name: string; phone: string; email: string;
  city: string; status: string; trips: number; joinDate: string;
  escalation: number; rating: number; totalSpent: number;
}

interface RiderState {
  riders: Rider[];
  selectedRiderId: string | null;
  selectRider: (id: string | null) => void;
  updateRiderStatus: (id: string, status: string) => void;
}

export const useRiderStore = create<RiderState>()((set) => ({
  riders: ridersData as Rider[],
  selectedRiderId: null,
  selectRider: (id) => set({ selectedRiderId: id }),
  updateRiderStatus: (id, status) =>
    set((s) => ({
      riders: s.riders.map((r) => (r.id === id ? { ...r, status } : r)),
    })),
}));

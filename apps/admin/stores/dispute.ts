'use client';
import { create } from 'zustand';
import disputesData from '@/data/mock-disputes.json';

export interface Dispute {
  id: string; tripId: string; raisedBy: string; raiserId: string;
  category: string; status: string; amount: number; description: string;
  date: string; assignedTo: string | null; resolution?: string;
}

interface DisputeState {
  disputes: Dispute[];
  selectedDisputeId: string | null;
  selectDispute: (id: string | null) => void;
  updateDisputeStatus: (id: string, status: string, resolution?: string) => void;
}

export const useDisputeStore = create<DisputeState>()((set) => ({
  disputes: disputesData as Dispute[],
  selectedDisputeId: null,
  selectDispute: (id) => set({ selectedDisputeId: id }),
  updateDisputeStatus: (id, status, resolution) =>
    set((s) => ({
      disputes: s.disputes.map((d) =>
        d.id === id ? { ...d, status, ...(resolution ? { resolution } : {}) } : d
      ),
    })),
}));

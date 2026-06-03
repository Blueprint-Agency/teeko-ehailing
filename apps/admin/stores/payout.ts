'use client';
import { create } from 'zustand';
import payoutsData from '@/data/mock-payouts.json';

export interface Payout {
  id: string; driverId: string; driverName: string; amount: number;
  period: string; status: string; method: string; bank: string;
  account: string; processedAt: string | null; failReason?: string;
}

interface PayoutState {
  payouts: Payout[];
  triggerPayout: (id: string) => void;
}

export const usePayoutStore = create<PayoutState>()((set) => ({
  payouts: payoutsData as Payout[],
  triggerPayout: (id) =>
    set((s) => ({
      payouts: s.payouts.map((p) =>
        p.id === id ? { ...p, status: 'processed', processedAt: new Date().toISOString() } : p
      ),
    })),
}));

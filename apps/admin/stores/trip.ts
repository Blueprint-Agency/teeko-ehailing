'use client';
import { create } from 'zustand';
import tripsData from '@/data/mock-trips.json';

export interface Trip {
  id: string; driverId: string; riderId: string; status: string;
  category: string; city: string; date: string; pickup: string;
  dropoff: string; distance: number; fare: number; commission: number;
  surge: number; paymentMethod: string; dispute: boolean;
}

interface TripState {
  trips: Trip[];
  selectedTripId: string | null;
  selectTrip: (id: string | null) => void;
}

export const useTripStore = create<TripState>()((set) => ({
  trips: tripsData as Trip[],
  selectedTripId: null,
  selectTrip: (id) => set({ selectedTripId: id }),
}));

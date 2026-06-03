import { create } from 'zustand';

export interface TripOffer {
  tripId: string;
  category: string;
  pickup: { lat: number; lng: number; address: string };
  destination: { lat: number; lng: number; address: string };
  fareCents: number;
  riderName: string;
  /** Countdown seconds — matches backend OFFER_TTL_SEC (15s) */
  countdownSeconds: number;
}

interface DriverStore {
  token: string | null;
  isOnline: boolean;
  radius: number;
  pendingOffer: TripOffer | null;
  activeTrip: TripOffer | null;
  activeTripId: string | null;
  setToken: (token: string | null) => void;
  setOnline: (v: boolean) => void;
  setRadius: (r: number) => void;
  setPendingOffer: (offer: TripOffer | null) => void;
  setActiveTrip: (offer: TripOffer | null) => void;
  setActiveTripId: (id: string | null) => void;
}

export const useDriverStore = create<DriverStore>((set) => ({
  token: null,
  isOnline: false,
  radius: 5,
  pendingOffer: null,
  activeTrip: null,
  activeTripId: null,
  setToken: (token) => set({ token }),
  setOnline: (isOnline) => set({ isOnline }),
  setRadius: (radius) => set({ radius }),
  setPendingOffer: (pendingOffer) => set({ pendingOffer }),
  setActiveTrip: (activeTrip) => set({ activeTrip }),
  setActiveTripId: (activeTripId) => set({ activeTripId }),
}));

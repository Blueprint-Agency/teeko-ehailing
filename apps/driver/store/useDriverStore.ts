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
  /**
   * Epoch ms of when this online session started, or null while offline. Drives
   * the live session timer on the home screen. Memory-only like the rest of this
   * store, so it restarts with the app — the UI labels it "this session" rather
   * than claiming a cumulative total it cannot back up.
   */
  onlineSince: number | null;
  radius: number;
  pendingOffer: TripOffer | null;
  activeTrip: TripOffer | null;
  activeTripId: string | null;
  /** DB status of the active trip — used to restore the correct phase after a crash */
  activeTripStatus: string | null;
  setToken: (token: string | null) => void;
  setOnline: (v: boolean) => void;
  setRadius: (r: number) => void;
  setPendingOffer: (offer: TripOffer | null) => void;
  setActiveTrip: (offer: TripOffer | null) => void;
  setActiveTripId: (id: string | null) => void;
  setActiveTripStatus: (status: string | null) => void;
}

export const useDriverStore = create<DriverStore>((set) => ({
  token: null,
  isOnline: false,
  onlineSince: null,
  radius: 5,
  pendingOffer: null,
  activeTrip: null,
  activeTripId: null,
  activeTripStatus: null,
  setToken: (token) => set({ token }),
  // The session clock is owned by the store, not the screen, so it survives
  // navigating away from home and can never drift out of sync with isOnline.
  setOnline: (isOnline) =>
    set((s) => ({
      isOnline,
      onlineSince: isOnline ? (s.onlineSince ?? Date.now()) : null,
    })),
  setRadius: (radius) => set({ radius }),
  setPendingOffer: (pendingOffer) => set({ pendingOffer }),
  setActiveTrip: (activeTrip) => set({ activeTrip }),
  setActiveTripId: (activeTripId) => set({ activeTripId }),
  setActiveTripStatus: (activeTripStatus) => set({ activeTripStatus }),
}));

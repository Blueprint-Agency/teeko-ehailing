import type {
  Driver,
  Fare,
  LatLng,
  Place,
  RideCategory,
  Trip,
  TripStatus,
} from '@teeko/shared';
import { create } from 'zustand';

// Minimal socket interface — avoids adding socket.io-client as a peer dep to @teeko/api
interface TripSocket {
  on(event: string, fn: (...args: any[]) => void): void;
  off(event: string, fn?: (...args: any[]) => void): void;
}

import * as tripsApi from '../client/trips';

export type TripState = {
  status: TripStatus;
  pickup: Place | null;
  destination: Place | null;
  rideType: RideCategory | null;
  paymentMethodId: string | null;
  fareOptions: Fare[];
  selectedFare: Fare | null;
  trip: Trip | null;
  driver: Driver | null;
  driverPosition: LatLng | null;
  driverHeading: number;
  driverEtaMin: number | null;
  history: Trip[];
  historyLoading: boolean;
  error: string | null;
  setPickup: (p: Place) => void;
  setDestination: (p: Place) => void;
  quote: () => Promise<void>;
  selectRideType: (r: RideCategory) => void;
  selectPayment: (id: string) => void;
  book: (riderId: string) => Promise<void>;
  cancel: (reason?: string) => Promise<void>;
  completeRide: () => void;
  rateTrip: (rating: number, comment?: string) => void;
  loadHistory: () => Promise<void>;
  reset: () => void;
  applyTripUpdate: (status: TripStatus, driver?: Driver) => void;
  connectSocket: (socket: TripSocket) => void;
  pollStatus: () => Promise<void>;
  restoreActiveTrip: () => Promise<string | null>;
};

let activeSocket: TripSocket | null = null;

export const useTripStore = create<TripState>((set, get) => ({
  status: 'idle',
  pickup: null,
  destination: null,
  rideType: null,
  paymentMethodId: null,
  fareOptions: [],
  selectedFare: null,
  trip: null,
  driver: null,
  driverPosition: null,
  driverHeading: 0,
  driverEtaMin: null,
  history: [],
  historyLoading: false,
  error: null,

  setPickup(p) {
    set({ pickup: p });
  },
  setDestination(p) {
    set({ destination: p });
  },

  async quote() {
    const { pickup, destination } = get();
    if (!pickup || !destination) return;
    set({ status: 'pending', error: null });
    try {
      const fareOptions = await tripsApi.estimate(pickup, destination);
      if (!Array.isArray(fareOptions)) throw new Error('Invalid fare response');
      set({ fareOptions, status: 'pending' });
    } catch (e) {
      set({ error: (e as Error).message, status: 'idle' });
    }
  },

  selectRideType(r) {
    const fare = get().fareOptions.find((f) => f.rideType === r) ?? null;
    set({ rideType: r, selectedFare: fare });
  },

  selectPayment(id) {
    set({ paymentMethodId: id });
  },

  async book(riderId) {
    const { pickup, destination, rideType, selectedFare, paymentMethodId } = get();
    if (!pickup || !destination || !rideType || !selectedFare || !paymentMethodId) {
      set({ error: 'Missing booking details' });
      return;
    }
    set({ status: 'searching', error: null });
    try {
      const trip = await tripsApi.book({
        pickup,
        destination,
        rideType,
        fare: selectedFare,
        paymentMethodId,
        riderId,
      });
      set({ trip, status: 'searching' });
      // Status transitions (matched → arrived → in_trip → completed) are
      // driven by socket events via applyTripUpdate / connectSocket.
    } catch (e: any) {
      if (e?.status === 409) {
        // Active trip already exists in DB — restore it and let the caller navigate
        await get().restoreActiveTrip();
        return;
      }
      set({ status: 'no_drivers', error: 'Could not create booking' });
    }
  },

  async cancel(reason) {
    const trip = get().trip;
    if (trip?.id) {
      await tripsApi.cancel(trip.id, reason);
    }
    set({
      status: 'cancelled',
      driver: null,
      driverPosition: null,
      driverEtaMin: null,
    });
  },

  completeRide() {
    set({ status: 'completed' });
  },

  rateTrip(rating, comment) {
    const trip = get().trip;
    if (!trip) {
      set({ status: 'idle' });
      return;
    }
    const rated: Trip = { ...trip, status: 'completed', rating, comment };
    set((s) => ({
      status: 'idle',
      trip: null,
      driver: null,
      driverPosition: null,
      pickup: null,
      destination: null,
      rideType: null,
      selectedFare: null,
      fareOptions: [],
      history: [rated, ...s.history],
    }));
  },

  async loadHistory() {
    set({ historyLoading: true });
    try {
      const history = await tripsApi.history();
      set({ history, historyLoading: false });
    } catch (e) {
      set({ historyLoading: false, error: (e as Error).message });
    }
  },

  applyTripUpdate(status, driver) {
    if (status === 'matched' && driver) {
      const existing = get().trip;
      set({ status: 'matched', driver, trip: existing ? { ...existing, driver, status: 'matched' } : null });
    } else if (status === 'arrived') {
      set({ status: 'arrived' });
    } else if (status === 'in_trip') {
      set({ status: 'in_trip' });
    } else if (status === 'completed') {
      set({ status: 'completed' });
    } else if (status === 'cancelled' || status === 'no_drivers') {
      set({ status: status as TripStatus });
    }
  },

  connectSocket(socket) {
    if (activeSocket) {
      activeSocket.off('trip.status_update');
      activeSocket.off('trip.no_drivers');
      activeSocket.off('driver.location');
    }
    activeSocket = socket;

    socket.on('trip.status_update', (data: { status: string; driver?: Driver }) => {
      get().applyTripUpdate(data.status as TripStatus, data.driver);
    });

    socket.on('trip.no_drivers', () => {
      set({ status: 'no_drivers', driver: null, driverPosition: null, driverEtaMin: null });
    });

    socket.on('driver.location', (data: { lat: number; lng: number; heading?: number; etaMin?: number }) => {
      set({
        driverPosition: { lat: data.lat, lng: data.lng },
        driverHeading: data.heading ?? 0,
        driverEtaMin: data.etaMin ?? null,
      });
    });
  },

  async pollStatus() {
    try {
      const active = await tripsApi.getActive();
      if (!active) {
        set({ status: 'cancelled' });
        return;
      }
      // backend now returns clientStatus (already mapped to TripStatus names)
      const mapped = active.clientStatus as TripStatus;
      if (mapped && mapped !== get().status) {
        set({ status: mapped });
      }
    } catch {
      // ignore — socket is the primary channel, polling is best-effort
    }
  },

  async restoreActiveTrip() {
    try {
      const session = await tripsApi.getActive();
      if (!session) return null;
      const { clientStatus, pickup, destination, driver, fare, rideType, tripId, paymentMethodId, createdAt } = session;
      const trip: Trip = {
        id: tripId,
        status: clientStatus as TripStatus,
        riderId: '',
        driver: driver ?? undefined,
        pickup,
        destination,
        rideType: rideType as RideCategory,
        fare: { ...fare, rideType: rideType as RideCategory },
        paymentMethodId,
        routePolyline: [],
        createdAt,
      };
      set({
        trip,
        status: clientStatus as TripStatus,
        pickup,
        destination,
        driver: driver ?? null,
        rideType: rideType as RideCategory,
        paymentMethodId,
      });
      return clientStatus;
    } catch {
      return null;
    }
  },

  reset() {
    set({
      status: 'idle',
      pickup: null,
      destination: null,
      rideType: null,
      paymentMethodId: null,
      fareOptions: [],
      selectedFare: null,
      trip: null,
      driver: null,
      driverPosition: null,
      driverHeading: 0,
      error: null,
    });
  },
}));

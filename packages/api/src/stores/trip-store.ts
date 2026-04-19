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

import * as tripsApi from '../mock/handlers/trips';
import { simulateDriverMovement } from '../utils/movement';

type TimerId = ReturnType<typeof setTimeout>;

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
};

// Timers live outside the store so they don't trigger re-renders.
const timers = new Set<TimerId>();
function clearTimers() {
  timers.forEach((t) => clearTimeout(t));
  timers.clear();
}
function schedule(fn: () => void, ms: number) {
  const t = setTimeout(() => {
    timers.delete(t);
    fn();
  }, ms);
  timers.add(t);
}

// Movement subscription tear-down handle.
let stopMovement: (() => void) | null = null;

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
    set({ status: 'pending' });
    const fareOptions = await tripsApi.estimate(pickup, destination);
    set({ fareOptions, status: 'pending' });
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
    const trip = await tripsApi.book({
      pickup,
      destination,
      rideType,
      fare: selectedFare,
      paymentMethodId,
      riderId,
    });
    set({ trip });

    try {
      const driver = await tripsApi.autoMatch(rideType);
      // Use the curved approach polyline emitted by book() so the driver tracks
      // along a road-like curve; fall back to a 2-point line if missing.
      const approachPolyline =
        trip.approachPolyline && trip.approachPolyline.length >= 2
          ? trip.approachPolyline
          : ([
              [pickup.lat + 0.008, pickup.lng + 0.008],
              [pickup.lat, pickup.lng],
            ] as Array<[number, number]>);
      const spawn = approachPolyline[0]!;
      set({
        driver,
        status: 'matched',
        trip: { ...trip, driver, status: 'matched' },
        driverPosition: { lat: spawn[0], lng: spawn[1] },
      });

      // Animate driver approaching pickup during the 15s matched phase.
      stopMovement?.();
      stopMovement = simulateDriverMovement(
        approachPolyline,
        15_000,
        ({ position, heading }) => set({ driverPosition: position, driverHeading: heading }),
      );

      // Driver arrives to pickup after ~15s in mock-time.
      schedule(() => {
        if (get().status !== 'matched') return;
        stopMovement?.();
        stopMovement = null;
        set({ status: 'arrived', driverPosition: { lat: pickup.lat, lng: pickup.lng } });

        // Auto-start trip 5s after arrival.
        schedule(() => {
          if (get().status !== 'arrived') return;
          set({ status: 'in_trip' });

          // Simulate trip movement along polyline (~25s).
          stopMovement?.();
          stopMovement = simulateDriverMovement(
            trip.routePolyline,
            25_000,
            ({ position, heading }) => set({ driverPosition: position, driverHeading: heading }),
            () => {
              get().completeRide();
            },
          );
        }, 5_000);
      }, 15_000);
    } catch {
      set({ status: 'no_drivers' });
    }
  },

  async cancel(reason) {
    clearTimers();
    stopMovement?.();
    stopMovement = null;
    const trip = get().trip;
    if (trip) {
      try {
        await tripsApi.cancel(trip.id, reason);
      } catch {
        // mock throws a sentinel — ignore.
      }
    }
    set({
      status: 'cancelled',
      driver: null,
      driverPosition: null,
    });
  },

  completeRide() {
    clearTimers();
    stopMovement?.();
    stopMovement = null;
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

  reset() {
    clearTimers();
    stopMovement?.();
    stopMovement = null;
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

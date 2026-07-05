// client/trips.ts
// Real-fetch shadow of mock/handlers/trips.ts. Surface matches what
// stores/trip-store.ts imports so F1 can swap atomically.
//
// Function names mirror the mock handler exports (`estimate`, `book`,
// `autoMatch`, `cancel`, `history`) rather than the canonical REST verbs,
// because the store imports them by those names. Endpoint paths follow the
// canonical spec from the Phase 1 plan.
//
// Backend endpoints not implemented yet — every call here will 404 until
// rider trips routes ship. Phase E's NotImplementedScreen prevents UI from
// reaching these in the meantime.

import type { Driver, Fare, Place, RideCategory, Trip, TripReceipt } from '@teeko/shared';

import { api } from './_fetch';

export async function estimate(
  pickup: Place,
  destination: Place,
): Promise<Fare[]> {
  return api<Fare[]>('/api/v1/rider/quotes', {
    method: 'POST',
    body: JSON.stringify({ pickup, destination }),
  });
}

export async function book(args: {
  pickup: Place;
  destination: Place;
  rideType: RideCategory;
  fare: Fare;
  paymentMethodId: string;
  riderId: string;
}): Promise<Trip> {
  return api<Trip>('/api/v1/rider/trips', {
    method: 'POST',
    body: JSON.stringify(args),
  });
}

export async function autoMatch(rideType: RideCategory): Promise<Driver> {
  return api<Driver>('/api/v1/rider/trips/match', {
    method: 'POST',
    body: JSON.stringify({ rideType }),
  });
}

export async function cancel(tripId: string, reason?: string): Promise<{ cancelled: boolean; feeCents: number }> {
  return api(
    `/api/v1/rider/trips/${encodeURIComponent(tripId)}`,
    {
      method: 'DELETE',
      body: JSON.stringify({ reason }),
    },
  );
}

export async function history(): Promise<Trip[]> {
  return api<Trip[]>('/api/v1/rider/trips');
}

export async function detail(tripId: string): Promise<TripReceipt> {
  return api<TripReceipt>(`/api/v1/rider/trips/${encodeURIComponent(tripId)}`);
}

export async function rate(
  tripId: string,
  rating: number,
  comment?: string,
): Promise<{ rating: number | null; comment: string | null }> {
  return api('/api/v1/rider/ratings', {
    method: 'POST',
    body: JSON.stringify({ tripId, rating, comment }),
  });
}

export type ActiveTripSession = {
  tripId: string;
  clientStatus: string;
  rideType: string;
  pickup: Place;
  destination: Place;
  fare: { rideType: string; amountMyr: number; etaMin: number };
  driver: Driver | null;
  paymentMethodId: string;
  createdAt: string;
};

export async function getActive(): Promise<ActiveTripSession | null> {
  const res = await api<{ ok: boolean; data: ActiveTripSession | null }>(
    '/api/v1/rider/trips/active',
  );
  return res.data;
}

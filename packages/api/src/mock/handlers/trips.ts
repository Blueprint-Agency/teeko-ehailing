import type { Driver, Fare, LatLng, Place, RideCategory, Trip } from '@teeko/shared';

import { simulateLatency } from '../delay';
import driversJson from '../data/drivers.json';
import fareEstimates from '../data/fare-estimates.json';
import placesJson from '../data/places.json';
import tripsJson from '../data/trips.json';

const drivers = driversJson as Driver[];
const places = placesJson as Place[];

type TripRecord = {
  id: string;
  status: 'completed' | 'cancelled';
  riderId: string;
  pickupId: string;
  destinationId: string;
  driverId?: string;
  rideType: RideCategory;
  fareMyr: number;
  etaMin: number;
  paymentMethodId: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  cancelledAt?: string;
  cancelReason?: string;
  rating?: number;
  comment?: string;
};

const tripRecords = tripsJson as TripRecord[];

const RIDE_TYPES: RideCategory[] = ['go', 'comfort', 'xl', 'premium', 'bike'];

function distanceKm(a: LatLng, b: LatLng): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

function buildPolyline(a: LatLng, b: LatLng, steps = 20): Array<[number, number]> {
  const pts: Array<[number, number]> = [];
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    // gentle curve via midpoint perturbation
    const lat = a.lat + (b.lat - a.lat) * t;
    const lng = a.lng + (b.lng - a.lng) * t;
    const wobble = 0.0015 * Math.sin(t * Math.PI);
    pts.push([lat + wobble, lng + wobble]);
  }
  return pts;
}

export async function estimate(
  pickup: Place,
  destination: Place,
): Promise<Fare[]> {
  await simulateLatency(400, 900);
  const km = Math.max(1, distanceKm(pickup, destination));
  const min = Math.max(5, km * 2);
  return RIDE_TYPES.map((rideType) => {
    const base = fareEstimates.baseFareMyr[rideType];
    const perKm = fareEstimates.perKmMyr[rideType];
    const perMin = fareEstimates.perMinMyr[rideType];
    const amount = Math.round((base + perKm * km + perMin * min) * 10) / 10;
    return {
      rideType,
      amountMyr: Math.round(amount * 100) / 100,
      etaMin: fareEstimates.etaBaselineMin[rideType] + Math.round(km / 5),
    };
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
  await simulateLatency(400, 1000);
  const id = `t_${Date.now()}`;
  return {
    id,
    status: 'searching',
    riderId: args.riderId,
    pickup: args.pickup,
    destination: args.destination,
    rideType: args.rideType,
    fare: args.fare,
    paymentMethodId: args.paymentMethodId,
    routePolyline: buildPolyline(args.pickup, args.destination),
    createdAt: new Date().toISOString(),
  };
}

export async function autoMatch(rideType: RideCategory): Promise<Driver> {
  // Used by trip-store after `book()` — returns a driver for the requested category.
  await simulateLatency(3000, 6000);
  const candidates = drivers.filter((d) => d.vehicle.category === rideType);
  const pool = candidates.length > 0 ? candidates : drivers;
  const index = Math.floor(Math.random() * pool.length);
  return pool[index]!;
}

export async function cancel(tripId: string, reason?: string): Promise<Trip> {
  await simulateLatency(300, 700);
  throw Object.assign(new Error(`cancel:${tripId}:${reason ?? 'user'}`), {
    code: 'NOT_PERSISTED',
  });
}

export async function history(): Promise<Trip[]> {
  await simulateLatency();
  return tripRecords.map<Trip>((t) => {
    const pickup = places.find((p) => p.id === t.pickupId)!;
    const destination = places.find((p) => p.id === t.destinationId)!;
    const driver = t.driverId ? drivers.find((d) => d.id === t.driverId) : undefined;
    return {
      id: t.id,
      status: t.status,
      riderId: t.riderId,
      pickup,
      destination,
      driver,
      rideType: t.rideType,
      fare: { rideType: t.rideType, amountMyr: t.fareMyr, etaMin: t.etaMin },
      paymentMethodId: t.paymentMethodId,
      routePolyline: buildPolyline(pickup, destination),
      createdAt: t.createdAt,
      startedAt: t.startedAt,
      completedAt: t.completedAt,
      cancelledAt: t.cancelledAt,
      cancelReason: t.cancelReason,
      rating: t.rating,
      comment: t.comment,
    };
  });
}

export async function byId(id: string): Promise<Trip | undefined> {
  const all = await history();
  return all.find((t) => t.id === id);
}

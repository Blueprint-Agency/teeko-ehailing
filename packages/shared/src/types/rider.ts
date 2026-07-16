// Rider-side domain types — source of truth for @teeko/api handlers + stores.

import type { Locale } from './index';

export type RideCategory = 'go' | 'comfort' | 'xl' | 'premium' | 'bike';

export type TripStatus =
  | 'idle'
  | 'pending'
  | 'searching'
  | 'no_drivers'
  | 'matched'
  | 'arrived'
  | 'in_trip'
  | 'completed'
  | 'cancelled';

// Mirrors the backend rider payment-method enum
// (apps/backend/src/api/rider/payments.routes.ts / modules/payments/repo.ts).
export type PaymentKind = 'cash' | 'card' | 'tng' | 'google_pay';

export interface Rider {
  id: string;
  name: string;
  phone: string;
  email?: string;
  rating: number;
  languagePref: Locale;
  verified?: boolean;
  signupDate?: string;
}

export interface Vehicle {
  model: string;
  colour: string;
  seats: number;
  category: RideCategory;
}

export interface Driver {
  id: string;
  name: string;
  photoUrl: string;
  rating: number;
  vehicle: Vehicle;
  plate: string;
  languages: Locale[];
  phone: string;
}

export type PlaceCategory = 'home' | 'work' | 'saved' | 'recent' | 'search';

export interface Place {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  category?: PlaceCategory;
}

export interface Fare {
  rideType: RideCategory;
  amountMyr: number;
  etaMin: number;
  surge?: number;
}

export interface PaymentMethod {
  id: string;
  kind: PaymentKind;
  label: string;
  last4?: string;
  isDefault?: boolean;
}

export type LatLng = { lat: number; lng: number };

export interface Trip {
  id: string;
  status: TripStatus;
  riderId: string;
  driver?: Driver;
  pickup: Place;
  destination: Place;
  rideType: RideCategory;
  fare: Fare;
  paymentMethodId: string;
  routePolyline: Array<[number, number]>;
  approachPolyline?: Array<[number, number]>;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  cancelledAt?: string;
  cancelReason?: string;
  rating?: number;
  comment?: string;
}

// ─── Trip receipt / detail ────────────────────────────────────────────────────

export type FareLineKind = 'base' | 'distance' | 'time' | 'surge' | 'toll' | 'airport' | 'tip';

export interface FareLineItem {
  kind: FareLineKind;
  amountMyr: number;
}

/** Full trip detail shown on the receipt screen (GET /rider/trips/:id). */
export interface TripReceipt {
  id: string;
  status: TripStatus;
  rideType: RideCategory;
  pickup: Place;
  destination: Place;
  fareMyr: number;
  fareLines: FareLineItem[];
  paymentLabel: string;
  cancellationFeeMyr?: number;
  driver?: Driver;
  rating?: number;
  comment?: string;
  createdAt: string;
  completedAt?: string;
  cancelledAt?: string;
  cancelReason?: string;
}

// ─── Disputes ─────────────────────────────────────────────────────────────────

export type DisputeCategory =
  | 'overcharge'
  | 'payment'
  | 'service'
  | 'safety'
  | 'lost_item'
  | 'other';

export type DisputeStatus = 'open' | 'under_review' | 'resolved' | 'rejected';

/** A rider-raised dispute on a finished trip (POST/GET /rider/disputes). */
export interface RiderDispute {
  id: string;
  tripId: string;
  category: DisputeCategory;
  status: DisputeStatus;
  /** Present only for money categories (overcharge / payment). */
  amountMyr?: number;
  description: string;
  /** Filled by an admin once the dispute is resolved or rejected. */
  resolution?: string;
  createdAt: string;
  resolvedAt?: string;
}

export interface CreateDisputeInput {
  tripId: string;
  category: DisputeCategory;
  amountMyr?: number;
  description: string;
}

// ─── Directions / Routing ─────────────────────────────────────────────────────

export type TravelMode = 'driving' | 'walking' | 'bicycling' | 'transit';

export interface FetchDirectionsOptions {
  mode?: TravelMode;
  /** Pass 'now' or a Unix timestamp to request traffic-aware duration for driving. */
  departureTime?: number | 'now';
}

export interface RouteStep {
  instruction: string;
  distanceMeters: number;
  durationSeconds: number;
  maneuver?: string;
  startLocation: { lat: number; lng: number };
  endLocation: { lat: number; lng: number };
}

export interface DirectionsResult {
  polyline: Array<[number, number]>;
  distanceMeters: number;
  durationSeconds: number;
  /** null when departureTime was not requested or mode is not driving */
  durationInTrafficSeconds: number | null;
  steps: RouteStep[];
  summary: string;
}

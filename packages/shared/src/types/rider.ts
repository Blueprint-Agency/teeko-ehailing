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

export type PaymentKind = 'card' | 'tng' | 'grabpay' | 'googlepay' | 'cash';

export interface Rider {
  id: string;
  name: string;
  phone: string;
  email?: string;
  rating: number;
  languagePref: Locale;
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
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  cancelledAt?: string;
  cancelReason?: string;
  rating?: number;
  comment?: string;
}

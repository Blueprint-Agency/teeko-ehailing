import type { DirectionsResult, FetchDirectionsOptions } from '@teeko/shared';
import { useDriverStore } from '../store/useDriverStore';

const BASE_URL = (process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000') + '/api/v1';

// Async getter registered at boot by TokenSync. Falls back to the store so the
// module works before registration (e.g. during Clerk initialization).
let _tokenGetter: () => Promise<string | null> = async () =>
  useDriverStore.getState().token;

export function registerTokenGetter(fn: () => Promise<string | null>): void {
  _tokenGetter = fn;
}

/**
 * Carries the parsed error body alongside the message. Screens that need to
 * branch on *which* error came back (change-password: bad code vs. rejected
 * password) read `.data`; everything else keeps using `.message` as before.
 */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly data: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function req<T = unknown>(path: string, options: RequestInit = {}): Promise<T> {
  const token = await _tokenGetter();
  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...((options.headers as Record<string, string>) ?? {}),
  };
  const fullUrl = `${BASE_URL}${path}`;
  let res: Response;
  try {
    res = await fetch(fullUrl, { ...options, headers });
  } catch (err) {
    console.error('[API] network error on', fullUrl, err);
    throw err;
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data?.message ?? data?.error?.message ?? data?.error ?? `HTTP ${res.status}`;
    throw new ApiError(String(msg), res.status, (data ?? {}) as Record<string, unknown>);
  }
  return data as T;
}

export type DriverMe = {
  user: {
    id: string;
    email: string | null;
    emailVerified: boolean;
    fullName: string | null;
    status: string;
    pdpaConsentAt: string | null;
  };
  driverProfile: { approvalStatus: string };
  // Set once the driver exists in our tables. Drives post-login routing —
  // a Clerk session alone does not mean the driver may accept trips.
  application: { state: string; rejectionReason: string | null; submittedAt: string | null } | null;
};

export type EarningsSummary = {
  tripCount: number;
  grossCents: number;
  commissionCents: number;
  netCents: number;
};

export type EarningsResponse = {
  lifetime: EarningsSummary;
  today: EarningsSummary;
  week: EarningsSummary;
  dailyBreakdown: Array<{
    date: string;
    day: string;
    amountRm: number;
    trips: number;
    isToday: boolean;
  }>;
  recent: Array<{
    tripId: string;
    grossRm: number;
    netRm: number;
    transferred: boolean;
    at: string;
    pickupAddress: string | null;
    dropoffAddress: string | null;
    riderName: string | null;
    ratingGiven: number | null;
    distanceKm: number | null;
    completedAt: string | null;
  }>;
  payouts: Array<{
    id: string;
    amountRm: number;
    method: string;
    status: string;
    at: string;
  }>;
  cashout: {
    eligible: boolean;
    connectStatus: string;
    payoutsEnabled: boolean;
    cooldownHoursLeft: number;
    minCashoutRm: number;
  };
};

export type DriverProfile = {
  id: string;
  fullName: string | null;
  phone: string | null;
  email: string | null;
  status: string;
  approvalStatus: string;
  availability: string;
  /** Null until the driver has been rated at least once. */
  rating: number | null;
  ratingCount: number;
  totalTrips: number;
  acceptanceRate: number | null;
  cancellationRate: number | null;
  completionRate: number | null;
  joinedAt: string;
};

export type VehicleDocKind = 'car_grant' | 'road_tax' | 'insurance' | 'puspakom';

export type VehicleDocStatus =
  | 'approved'
  | 'pending'
  | 'rejected'
  | 'expiring_soon'
  | 'expired'
  | 'missing';

export type DriverVehicle = {
  id: string;
  plateNumber: string;
  make: string;
  model: string;
  year: number;
  colour: string | null;
  category: string;
  documents: Array<{ kind: VehicleDocKind; status: VehicleDocStatus; expiry: string | null }>;
};

export type EmergencyContact = {
  id: string;
  name: string;
  phone: string;
  relation: string | null;
};

export type SosAlert = {
  id: string;
  tripId: string | null;
  createdAt: string;
  resolvedAt: string | null;
  notifiedContacts: EmergencyContact[];
};

export type ConnectStatus = {
  status: 'not_started' | 'pending' | 'active' | 'restricted' | string;
  payoutsEnabled: boolean;
};

export const api = {
  auth: {
    me: () =>
      req<DriverMe>('/driver/auth/me'),
    sendOtp: () => req<{ ok: true }>('/driver/auth/send-otp', { method: 'POST', body: JSON.stringify({}) }),
    verifyOtp: (code: string) => req<{ ok: true }>('/driver/auth/verify-otp', { method: 'POST', body: JSON.stringify({ code }) }),
    // Verifies the emailed OTP and writes the new password in one call — the
    // server uses Clerk's admin API, so the current password isn't needed.
    changePassword: (code: string, newPassword: string) =>
      req<{ ok: true }>('/driver/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ code, newPassword }),
      }),
  },
  driver: {
    goOnline: () => req('/driver/status/online', { method: 'PUT' }),
    goOffline: () => req('/driver/status/offline', { method: 'PUT' }),
    updateLocation: (lat: number, lng: number, heading: number) =>
      req('/driver/status/location', { method: 'PUT', body: JSON.stringify({ lat, lng, heading }) }),
    setRadius: (radiusKm: number) =>
      req('/driver/status/radius', { method: 'PUT', body: JSON.stringify({ radiusKm }) }),
    acceptTrip: (tripId: string) =>
      req<{ ok: boolean; data: { tripId: string; status: string; riderId: string } }>(
        `/driver/trips/${tripId}/accept`, { method: 'POST' }
      ),
    declineTrip: (tripId: string) => req(`/driver/trips/${tripId}/decline`, { method: 'POST' }),
    arrivedAtPickup: (tripId: string) => req(`/driver/trips/${tripId}/arrived`, { method: 'POST' }),
    startTrip: (tripId: string) => req(`/driver/trips/${tripId}/start`, { method: 'POST' }),
    completeTrip: (tripId: string) => req(`/driver/trips/${tripId}/complete`, { method: 'POST' }),
    cancelTrip: (tripId: string, reasonCode = 'driver_cancelled') =>
      req(`/driver/trips/${tripId}/cancel`, { method: 'POST', body: JSON.stringify({ reasonCode }) }),
    getActiveTrip: () =>
      req<{
        ok: boolean;
        data: {
          tripId: string;
          status: string;
          category: string;
          pickup: { lat: number; lng: number; address: string };
          destination: { lat: number; lng: number; address: string };
          fareCents: number;
          riderName: string;
          countdownSeconds: number;
        } | null;
      }>('/driver/trips/active'),
    directions: (
      origin: { lat: number; lng: number },
      destination: { lat: number; lng: number },
      options?: FetchDirectionsOptions,
    ) =>
      req<DirectionsResult>('/driver/directions', {
        method: 'POST',
        body: JSON.stringify({ origin, destination, ...options }),
      }),
  },
  earnings: {
    get: () => req<EarningsResponse>('/driver/earnings'),
    cashout: () =>
      req<{ amountRm: number; status: string }>('/driver/earnings/cashout', { method: 'POST' }),
  },
  profile: {
    get: () => req<{ profile: DriverProfile }>('/driver/profile'),
    // Name and phone only — licence, vehicle and approval data are verified
    // records and change through the web portal, not here.
    update: (patch: { fullName?: string; phone?: string }) =>
      req<{ profile: DriverProfile }>('/driver/profile', {
        method: 'PATCH',
        body: JSON.stringify(patch),
      }),
  },
  // A driver has exactly one vehicle — there is no list and nothing to switch.
  vehicle: {
    get: () => req<{ vehicle: DriverVehicle | null }>('/driver/vehicle'),
  },
  safety: {
    // Panic button. Records the alert server-side with the driver's location and
    // a snapshot of their emergency contacts; dialling 999 stays on the device.
    sos: (input: { tripId?: string | null; lat: number; lng: number }) =>
      req<SosAlert>('/driver/safety/sos', { method: 'POST', body: JSON.stringify(input) }),
    activeSos: () => req<{ alert: SosAlert | null }>('/driver/safety/sos/active'),
    resolveSos: (id: string) =>
      req<SosAlert>(`/driver/safety/sos/${id}/resolve`, { method: 'POST' }),
    contacts: () => req<{ contacts: EmergencyContact[] }>('/driver/safety/contacts'),
    reportIncident: (input: { tripId?: string | null; reason: string }) =>
      req<{ id: string; status: string; createdAt: string }>('/driver/safety/incident-reports', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
  },
  // Stripe Connect payout onboarding. `onboard` returns a hosted Stripe URL the
  // app opens in the system browser; status is polled on return.
  connect: {
    onboard: () => req<{ onboardingUrl: string }>('/driver/connect/onboard', { method: 'POST' }),
    status: () => req<ConnectStatus>('/driver/connect/status'),
  },
};

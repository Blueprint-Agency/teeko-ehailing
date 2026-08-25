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

/**
 * Resolve a server-supplied media path (avatars, documents) to something
 * <Image> can load. Storage returns a relative `/uploads/...` path for the
 * local adapter and an absolute URL once GCS/R2 is wired, so only the relative
 * form needs the API origin glued on.
 */
export function resolveMediaUrl(path: string | null | undefined): string | undefined {
  if (!path) return undefined;
  if (/^https?:\/\//i.test(path)) return path;
  const origin = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';
  return `${origin}${path.startsWith('/') ? path : `/${path}`}`;
}

async function req<T = unknown>(path: string, options: RequestInit = {}): Promise<T> {
  const token = await _tokenGetter();
  // FormData carries its own multipart boundary in the Content-Type header —
  // forcing application/json here makes the server reject the upload.
  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...(options.body && !isFormData ? { 'Content-Type': 'application/json' } : {}),
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

// ── Signed-out password reset ───────────────────────────────────────────────
// "Forgot password" runs against Clerk from the device, so the one-reset-per-
// week rule has to be asked for explicitly before Clerk emails a code, and
// reported back once Clerk accepts the new password. Both calls are
// unauthenticated and sit under /api/public, not /api/v1.
const PUBLIC_URL = (process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000') + '/api/public';

export type PasswordResetEligibility = {
  allowed: boolean;
  /** ISO instant the next reset unlocks; null when a reset is allowed now. */
  nextAllowedAt: string | null;
  retryInSeconds: number;
};

async function publicPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${PUBLIC_URL}${path}`, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(String(data?.error ?? `HTTP ${res.status}`), res.status, data ?? {});
  }
  return data as T;
}

export const passwordReset = {
  /**
   * An unknown address always answers `allowed`, so this can never be used to
   * probe whether someone holds a Teeko account.
   */
  eligibility: (email: string) =>
    publicPost<PasswordResetEligibility>('/password-reset/eligibility', { email }),
  /** Call once Clerk has accepted the new password — starts the 7-day clock. */
  record: (email: string) => publicPost<{ ok: true }>('/password-reset/record', { email }),
};

export type DriverMe = {
  user: {
    id: string;
    email: string | null;
    emailVerified: boolean;
    fullName: string | null;
    /** Raw server value — pass through `resolveMediaUrl` before rendering. */
    avatarUrl: string | null;
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
    /** Settled and cashable today. null when the balance couldn't be read. */
    availableRm: number | null;
    /** Earned but still inside Stripe's settlement hold. */
    clearingRm: number | null;
    /** Paid out, not yet credited by the bank. */
    inTransitRm: number;
    /** ISO date of the soonest expected bank credit, if any payout is in flight. */
    inTransitArrival: string | null;
  };
};

export type DriverProfile = {
  id: string;
  fullName: string | null;
  phone: string | null;
  email: string | null;
  /** Raw server value — pass through `resolveMediaUrl` before rendering. */
  avatarUrl: string | null;
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

// ── Profile change review ───────────────────────────────────────────────────
// Name and phone are identity evidence for APAD/JPJ, so editing them raises a
// request an admin has to approve. Each field may change once every 30 days,
// counted from the last approved change — a rejection costs nothing.
export type ProfileChangeField = 'full_name' | 'phone';

export type ProfileChangeRequest = {
  id: string;
  field: ProfileChangeField;
  currentValue: string | null;
  requestedValue: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  reviewNote: string | null;
  reviewedAt: string | null;
  appliedAt: string | null;
  createdAt: string;
};

export type ProfileFieldState = {
  field: ProfileChangeField;
  /** Set while a request is waiting on an admin. */
  pending: ProfileChangeRequest | null;
  /** Set while the field is inside its 30-day cooldown; null means editable. */
  nextAllowedAt: string | null;
  lastDecision: ProfileChangeRequest | null;
};

/** Per-field outcome of a PATCH — a two-field edit can half-succeed. */
export type ProfileChangeResult = { field: ProfileChangeField } & (
  | { status: 'submitted'; request: ProfileChangeRequest }
  | { status: 'unchanged' }
  | { status: 'already_pending'; request: ProfileChangeRequest }
  | { status: 'cooldown'; nextAllowedAt: string }
  | { status: 'phone_taken' }
);

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
  status: 'not_started' | 'onboarding' | 'pending' | 'active' | 'restricted' | string;
  payoutsEnabled: boolean;
};

// A dispute the driver filed from Support → Report Issue. Same record and
// admin queues as a rider-raised dispute; the trip is optional because a
// document or account report isn't tied to one.
export type DriverDisputeCategory =
  | 'overcharge'
  | 'payment'
  | 'document'
  | 'account'
  | 'other';

export type DriverDisputeStatus =
  | 'open'
  | 'under_review'
  | 'escalated'
  | 'resolved'
  | 'rejected'
  | 'refund_pending'
  | 'refund_processing'
  | 'refund_completed'
  | 'refund_failed';

export type DriverDispute = {
  id: string;
  tripId: string | null;
  category: DriverDisputeCategory;
  status: DriverDisputeStatus;
  /** Present only for money categories (overcharge / payment). */
  amountMyr?: number;
  description: string;
  /** Filled by an admin once the dispute is resolved or rejected. */
  resolution?: string;
  createdAt: string;
  resolvedAt?: string;
};

// A finished trip, as listed in the Report Issue trip picker.
export type DriverFinishedTrip = {
  id: string;
  status: 'completed' | 'cancelled' | 'no_show';
  pickupAddress: string | null;
  dropoffAddress: string | null;
  fareMyr: number;
  finishedAt: string;
};

export type CreateDriverDisputeInput = {
  tripId?: string | null;
  category: DriverDisputeCategory;
  amountMyr?: number;
  description: string;
};

export const api = {
  auth: {
    me: () =>
      req<DriverMe>('/driver/auth/me'),
    // `purpose: 'password_change'` makes the server apply the one-change-per-
    // week rule *before* emailing a code, so the driver never types a code that
    // was never going to be spendable. 429 `password_change_cooldown` carries
    // `nextAllowedAt`.
    sendOtp: (purpose?: 'email_verification' | 'password_change') =>
      req<{ ok: true }>('/driver/auth/send-otp', {
        method: 'POST',
        body: JSON.stringify(purpose ? { purpose } : {}),
      }),
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
    // Finished trips only — the set a dispute may be raised against.
    tripHistory: (limit = 30) =>
      req<{ ok: boolean; data: DriverFinishedTrip[] }>(`/driver/trips/history?limit=${limit}`),
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
      req<{ amountRm: number; status: string; method: 'instant' | 'standard' }>(
        '/driver/earnings/cashout',
        { method: 'POST' },
      ),
  },
  profile: {
    get: () =>
      req<{ profile: DriverProfile; fields: ProfileFieldState[] }>('/driver/profile'),
    // Name and phone only — licence, vehicle and approval data are verified
    // records and change through the web portal, not here. Even these two are
    // *requests*: nothing changes until an admin approves, so read `results`
    // rather than assuming the returned profile reflects the edit.
    update: (patch: { fullName?: string; phone?: string }) =>
      req<{
        profile: DriverProfile;
        fields: ProfileFieldState[];
        results: ProfileChangeResult[];
      }>('/driver/profile', {
        method: 'PATCH',
        body: JSON.stringify(patch),
      }),
    /**
     * Profile picture. Display-only, so unlike name and phone it applies
     * immediately instead of raising a change request. `uri` is whatever the
     * image picker returned; RN's FormData streams that file directly.
     * Returns the absolute URL of the stored image.
     */
    uploadAvatar: async (file: { uri: string; name?: string; mimeType?: string }) => {
      const form = new FormData();
      form.append('file', {
        uri: file.uri,
        name: file.name ?? 'avatar.jpg',
        type: file.mimeType ?? 'image/jpeg',
      } as unknown as Blob);
      const res = await req<{ avatarUrl: string }>('/driver/profile/avatar', {
        method: 'POST',
        body: form,
      });
      // Non-null: the server only answers 200 with a stored path.
      return resolveMediaUrl(res.avatarUrl)!;
    },
    /** Remove the picture and fall back to the initials avatar. */
    removeAvatar: () =>
      req<{ avatarUrl: null }>('/driver/profile/avatar', { method: 'DELETE' }),
    changes: () => req<{ requests: ProfileChangeRequest[] }>('/driver/profile/changes'),
    /** Withdraw a request still waiting on review. */
    cancelChange: (id: string) =>
      req<{ ok: true; fields: ProfileFieldState[] }>(`/driver/profile/changes/${id}`, {
        method: 'DELETE',
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
  // Report Issue → a real dispute in the admin Disputes Queue, the same place
  // rider-raised disputes land.
  disputes: {
    list: () => req<DriverDispute[]>('/driver/disputes'),
    create: (input: CreateDriverDisputeInput) =>
      req<DriverDispute>('/driver/disputes', { method: 'POST', body: JSON.stringify(input) }),
  },
  // Stripe Connect payout onboarding. `onboard` returns a hosted Stripe URL the
  // app opens in the system browser; status is polled on return.
  connect: {
    onboard: () => req<{ onboardingUrl: string }>('/driver/connect/onboard', { method: 'POST' }),
    status: () => req<ConnectStatus>('/driver/connect/status'),
  },
};

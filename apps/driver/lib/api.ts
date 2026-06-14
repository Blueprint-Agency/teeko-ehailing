import { useDriverStore } from '../store/useDriverStore';

const BASE_URL = (process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000') + '/api/v1';

// Async getter registered at boot by TokenSync. Falls back to the store so the
// module works before registration (e.g. during Clerk initialization).
let _tokenGetter: () => Promise<string | null> = async () =>
  useDriverStore.getState().token;

export function registerTokenGetter(fn: () => Promise<string | null>): void {
  _tokenGetter = fn;
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
  console.log('[API] -->', options.method ?? 'GET', fullUrl);
  console.log('[API] headers:', JSON.stringify(headers, null, 2));
  if (options.body) console.log('[API] body:', options.body);
  let res: Response;
  try {
    res = await fetch(fullUrl, { ...options, headers });
  } catch (err) {
    console.error('[API] network error on', fullUrl, err);
    throw err;
  }
  console.log('[API] <--', res.status, fullUrl);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data?.message ?? data?.error?.message ?? data?.error ?? `HTTP ${res.status}`;
    throw new Error(String(msg));
  }
  return data as T;
}

export const api = {
  auth: {
    me: () => req<{ user: { id: string; email: string | null; fullName: string | null; status: string }; driverProfile: { approvalStatus: string } }>('/driver/auth/me'),
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
  },
};

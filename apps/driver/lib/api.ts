import { useDriverStore } from '../store/useDriverStore';

const BASE_URL = (process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000') + '/api/v1';

async function req<T = unknown>(path: string, options: RequestInit = {}): Promise<T> {
  const token = useDriverStore.getState().token;
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers ?? {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data?.error?.message ?? data?.error ?? `HTTP ${res.status}`;
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

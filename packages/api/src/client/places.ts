// client/places.ts
// Real-fetch shadow of mock/handlers/places.ts. Exposes the surface consumed
// by stores/places-store.ts so F1 can swap imports atomically.
// Backend endpoints are not implemented yet — these will 404 until rider
// places routes ship. Phase E's NotImplementedScreen prevents UI from
// invoking these in the meantime.

import type { Place } from '@teeko/shared';

import { api } from './_fetch';

export async function recentPlaces(): Promise<Place[]> {
  return api<Place[]>('/api/v1/rider/places/recent');
}

export async function savedPlaces(): Promise<Place[]> {
  return api<Place[]>('/api/v1/rider/places/saved');
}

export async function searchPlaces(query: string): Promise<Place[]> {
  return api<Place[]>(
    `/api/v1/rider/places/search?q=${encodeURIComponent(query)}`,
  );
}

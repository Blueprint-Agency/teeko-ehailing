// client/places.ts
// Real-fetch shadow of mock/handlers/places.ts. Backed by the rider /places/*
// routes, which proxy Google Places for search/details and persist saved/recent
// rows in Postgres.

import type { Place } from '@teeko/shared';

import { api } from './_fetch';

export async function recentPlaces(): Promise<Place[]> {
  return api<Place[]>('/api/v1/rider/places/recent');
}

export async function savedPlaces(): Promise<Place[]> {
  return api<Place[]>('/api/v1/rider/places/saved');
}

export async function searchPlaces(
  query: string,
  near?: { lat: number; lng: number },
): Promise<Place[]> {
  const params = new URLSearchParams({ q: query });
  if (near) {
    params.set('lat', String(near.lat));
    params.set('lng', String(near.lng));
  }
  return api<Place[]>(`/api/v1/rider/places/search?${params.toString()}`);
}

export async function placeDetails(placeId: string): Promise<Place> {
  const params = new URLSearchParams({ placeId });
  return api<Place>(`/api/v1/rider/places/details?${params.toString()}`);
}

export async function upsertSavedPlace(input: {
  label: 'home' | 'work' | 'custom';
  address: string;
  lat: number;
  lng: number;
}): Promise<Place> {
  return api<Place>('/api/v1/rider/places/saved', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function deleteSavedPlace(id: string): Promise<void> {
  await api<void>(`/api/v1/rider/places/saved/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

export async function pushRecentPlace(input: {
  label: string;
  address: string;
  lat: number;
  lng: number;
}): Promise<Place> {
  return api<Place>('/api/v1/rider/places/recent', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

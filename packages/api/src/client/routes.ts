// client/routes.ts
// Directions proxy — calls the backend which holds the Google API key server-side.

import type { DirectionsResult, FetchDirectionsOptions } from '@teeko/shared';

import { api } from './_fetch';

export async function fetchDirections(
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number },
  options: FetchDirectionsOptions = {},
): Promise<DirectionsResult> {
  return api<DirectionsResult>('/api/v1/rider/directions', {
    method: 'POST',
    body: JSON.stringify({ origin, destination, ...options }),
  });
}

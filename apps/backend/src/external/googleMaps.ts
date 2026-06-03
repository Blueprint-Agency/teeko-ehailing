import { env } from '../config/env';

const BASE = 'https://maps.googleapis.com/maps/api';

export class MapsApiError extends Error {
  constructor(message: string, public statusCode = 502) {
    super(message);
    this.name = 'MapsApiError';
  }
}

async function get(path: string, params: Record<string, string>): Promise<unknown> {
  const qs = new URLSearchParams({ ...params, key: env.GOOGLE_MAPS_API_KEY }).toString();
  const res = await fetch(`${BASE}${path}?${qs}`);
  if (!res.ok) throw new MapsApiError(`maps api ${res.status}`, 502);
  const json = (await res.json()) as { status: string };
  if (json.status !== 'OK' && json.status !== 'ZERO_RESULTS') {
    throw new MapsApiError(`maps api status ${json.status}`, 502);
  }
  return json;
}

export type DistanceMatrixResult = {
  distanceMeters: number;
  durationSeconds: number;
};

export async function getDistanceMatrix(
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number },
): Promise<DistanceMatrixResult> {
  const json = (await get('/distancematrix/json', {
    origins: `${origin.lat},${origin.lng}`,
    destinations: `${destination.lat},${destination.lng}`,
    mode: 'driving',
    departure_time: 'now',
    traffic_model: 'best_guess',
    units: 'metric',
  })) as {
    rows: Array<{
      elements: Array<{
        status: string;
        distance: { value: number };
        duration: { value: number };
        duration_in_traffic?: { value: number };
      }>;
    }>;
  };

  const el = json.rows[0]?.elements[0];
  if (!el || el.status !== 'OK') throw new MapsApiError('ROUTE_UNAVAILABLE', 422);

  return {
    distanceMeters: el.distance.value,
    durationSeconds: el.duration_in_traffic?.value ?? el.duration.value,
  };
}

export async function reverseGeocode(lat: number, lng: number): Promise<string> {
  const json = (await get('/geocode/json', {
    latlng: `${lat},${lng}`,
    result_type: 'street_address|route',
    language: 'en',
  })) as { results: Array<{ formatted_address: string }> };
  return json.results[0]?.formatted_address ?? `${lat},${lng}`;
}

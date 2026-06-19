// modules/maps/service.ts
// Google Places (New) + Directions proxy.
// Routes call into this service; never import from routes.

import { env } from '../../config/env';

const PLACES_BASE = 'https://places.googleapis.com/v1';
const DIRECTIONS_BASE = 'https://maps.googleapis.com/maps/api/directions/json';
const REGION_CODE = 'MY';
const DEFAULT_BIAS_RADIUS_M = 50_000;

// ---------------------------------------------------------------------------
// Shared error
// ---------------------------------------------------------------------------

export class MapsError extends Error {
  override readonly name = 'MapsError';
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
  }
}

// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------

export type AutocompleteInput = {
  q: string;
  near?: { lat: number; lng: number };
};

export type TravelMode = 'driving' | 'walking' | 'bicycling' | 'transit';

export type DirectionsInput = {
  origin: { lat: number; lng: number };
  destination: { lat: number; lng: number };
  mode?: TravelMode;
  departureTime?: number | 'now';
};

export type DirectionsServiceResult = {
  polyline: Array<[number, number]>;
  distanceMeters: number;
  durationSeconds: number;
  durationInTrafficSeconds: number | null;
  steps: Array<{
    instruction: string;
    distanceMeters: number;
    durationSeconds: number;
    maneuver?: string;
    startLocation: { lat: number; lng: number };
    endLocation: { lat: number; lng: number };
  }>;
  summary: string;
};

export type MapsPrediction = {
  id: string;
  name: string;
  address: string;
};

export type MapsPlaceDetails = {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
};

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function decodePolyline(encoded: string): Array<[number, number]> {
  const pts: Array<[number, number]> = [];
  let idx = 0, lat = 0, lng = 0;
  while (idx < encoded.length) {
    let shift = 0, result = 0, b: number;
    do { b = encoded.charCodeAt(idx++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    lat += result & 1 ? ~(result >> 1) : result >> 1;
    shift = 0; result = 0;
    do { b = encoded.charCodeAt(idx++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    lng += result & 1 ? ~(result >> 1) : result >> 1;
    pts.push([lat / 1e5, lng / 1e5]);
  }
  return pts;
}

async function callGoogle(
  path: string,
  init: RequestInit & { fieldMask?: string },
): Promise<unknown> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Goog-Api-Key': env.GOOGLE_MAPS_API_KEY,
    ...(init.headers as Record<string, string> | undefined),
  };
  if (init.fieldMask) headers['X-Goog-FieldMask'] = init.fieldMask;
  const res = await fetch(`${PLACES_BASE}${path}`, { ...init, headers });
  if (!res.ok) {
    const body = await res.text();
    // 4xx from Google → 502 (we sent a malformed request); 5xx → 502 too.
    throw new MapsError(`google places ${res.status}: ${body}`, 502);
  }
  return res.json();
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export const mapsService = {
  async autocomplete(input: AutocompleteInput): Promise<MapsPrediction[]> {
    const body: Record<string, unknown> = {
      input: input.q,
      regionCode: REGION_CODE,
    };
    if (input.near) {
      body.locationBias = {
        circle: {
          center: { latitude: input.near.lat, longitude: input.near.lng },
          radius: DEFAULT_BIAS_RADIUS_M,
        },
      };
    }
    const json = (await callGoogle('/places:autocomplete', {
      method: 'POST',
      body: JSON.stringify(body),
    })) as {
      suggestions?: Array<{
        placePrediction?: {
          placeId: string;
          text?: { text?: string };
          structuredFormat?: {
            mainText?: { text?: string };
            secondaryText?: { text?: string };
          };
        };
      }>;
    };
    const out: MapsPrediction[] = [];
    for (const s of json.suggestions ?? []) {
      const p = s.placePrediction;
      if (!p?.placeId) continue;
      const main = p.structuredFormat?.mainText?.text;
      const secondary = p.structuredFormat?.secondaryText?.text;
      out.push({
        id: p.placeId,
        name: main ?? p.text?.text ?? '',
        address: secondary ?? '',
      });
    }
    return out;
  },

  async directions(input: DirectionsInput): Promise<DirectionsServiceResult> {
    const { origin, destination, mode = 'driving', departureTime } = input;
    const params = new URLSearchParams({
      origin: `${origin.lat},${origin.lng}`,
      destination: `${destination.lat},${destination.lng}`,
      mode,
      key: env.GOOGLE_MAPS_API_KEY,
    });
    if (departureTime !== undefined) {
      params.set('departure_time', String(departureTime));
      if (mode === 'driving') params.set('traffic_model', 'best_guess');
    }
    const res = await fetch(`${DIRECTIONS_BASE}?${params.toString()}`);
    if (!res.ok) {
      throw new MapsError(`google directions ${res.status}`, 502);
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const json = (await res.json()) as any;
    if (json.status !== 'OK') {
      throw new MapsError(`google directions ${json.status as string}`, 422);
    }
    const route = json.routes[0];
    const leg = route.legs[0];
    return {
      polyline: decodePolyline(route.overview_polyline.points as string),
      distanceMeters: (leg.distance?.value as number) ?? 0,
      durationSeconds: (leg.duration?.value as number) ?? 0,
      durationInTrafficSeconds: (leg.duration_in_traffic?.value as number) ?? null,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      steps: (leg.steps as any[]).map((s) => ({
        instruction: (s.html_instructions as string).replace(/<[^>]*>/g, ''),
        distanceMeters: (s.distance?.value as number) ?? 0,
        durationSeconds: (s.duration?.value as number) ?? 0,
        maneuver: s.maneuver as string | undefined,
        startLocation: s.start_location as { lat: number; lng: number },
        endLocation: s.end_location as { lat: number; lng: number },
      })),
      summary: (route.summary as string) ?? '',
    };
  },

  async placeDetails(placeId: string): Promise<MapsPlaceDetails> {
    const json = (await callGoogle(`/places/${encodeURIComponent(placeId)}`, {
      method: 'GET',
      fieldMask: 'id,displayName,formattedAddress,location',
    })) as {
      id?: string;
      displayName?: { text?: string };
      formattedAddress?: string;
      location?: { latitude?: number; longitude?: number };
    };
    if (
      !json.id ||
      !json.location ||
      typeof json.location.latitude !== 'number' ||
      typeof json.location.longitude !== 'number'
    ) {
      throw new MapsError('google places details missing required fields', 502);
    }
    return {
      id: json.id,
      name: json.displayName?.text ?? '',
      address: json.formattedAddress ?? '',
      lat: json.location.latitude,
      lng: json.location.longitude,
    };
  },
};

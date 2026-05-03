// modules/maps/service.ts
// Google Places (New) proxy — autocomplete + details.
// Routes call into this service; never import from routes.

import { env } from '../../config/env';

const PLACES_BASE = 'https://places.googleapis.com/v1';
const REGION_CODE = 'MY';
const DEFAULT_BIAS_RADIUS_M = 50_000;

// ---------------------------------------------------------------------------
// Shared error
// ---------------------------------------------------------------------------

export class MapsError extends Error {
  readonly name = 'MapsError';
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

export type MapsPrediction = {
  id: string;
  name: string;
  address: string;
};

// ---------------------------------------------------------------------------
// Internal HTTP helper
// ---------------------------------------------------------------------------

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

  // placeDetails added in Task 3
};

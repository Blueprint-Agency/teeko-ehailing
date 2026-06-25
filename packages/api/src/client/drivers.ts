// client/drivers.ts
// Ambient online-driver positions for the rider home map. Backed by the
// backend's Redis GEO index via GET /api/v1/rider/nearby-drivers.

import type { LatLng } from '@teeko/shared';

import { api } from './_fetch';

export interface NearbyDriver {
  lat: number;
  lng: number;
  heading: number;
}

/** Online drivers within `radiusKm` of `at`, nearest first. Returns coarse
 *  positions only (no driver identity). Safe to poll on an interval. */
export async function nearby(at: LatLng, radiusKm = 10): Promise<NearbyDriver[]> {
  const params = new URLSearchParams({
    lat: String(at.lat),
    lng: String(at.lng),
    radiusKm: String(radiusKm),
  });
  const res = await api<{ ok: boolean; data: NearbyDriver[] }>(
    `/api/v1/rider/nearby-drivers?${params.toString()}`,
  );
  return res.data;
}

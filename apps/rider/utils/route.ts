import type { LatLng } from '@teeko/shared';

export type LatLngLiteral = { latitude: number; longitude: number };

// Quadratic Bézier — gently-curved polyline that reads as a road route in mockups.
export function curvedRoute(
  a: LatLng,
  b: LatLng,
  samples = 32,
  bend = 0.18,
): LatLngLiteral[] {
  const mx = (a.lat + b.lat) / 2;
  const my = (a.lng + b.lng) / 2;
  const dx = b.lat - a.lat;
  const dy = b.lng - a.lng;
  const cx = mx + -dy * bend;
  const cy = my + dx * bend;
  const pts: LatLngLiteral[] = [];
  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    const u = 1 - t;
    const lat = u * u * a.lat + 2 * u * t * cx + t * t * b.lat;
    const lng = u * u * a.lng + 2 * u * t * cy + t * t * b.lng;
    pts.push({ latitude: lat, longitude: lng });
  }
  return pts;
}

// Project driver position onto a polyline to find the split index (0..polyline.length-1)
// so we can render traveled vs remaining segments. Uses simple Euclidean nearest-vertex
// lookup — exact enough for 20–48 point mock routes and free of dependencies.
export function nearestIndex(polyline: LatLngLiteral[], p: LatLng): number {
  let best = 0;
  let bestDist = Infinity;
  for (let i = 0; i < polyline.length; i++) {
    const dLat = polyline[i]!.latitude - p.lat;
    const dLng = polyline[i]!.longitude - p.lng;
    const d = dLat * dLat + dLng * dLng;
    if (d < bestDist) {
      bestDist = d;
      best = i;
    }
  }
  return best;
}

export function splitPolylineAt(
  polyline: LatLngLiteral[],
  at: LatLng,
): { traveled: LatLngLiteral[]; remaining: LatLngLiteral[] } {
  if (polyline.length < 2) return { traveled: [], remaining: polyline };
  const idx = nearestIndex(polyline, at);
  const cut = { latitude: at.lat, longitude: at.lng };
  const traveled = [...polyline.slice(0, idx + 1), cut];
  const remaining = [cut, ...polyline.slice(idx + 1)];
  return { traveled, remaining };
}

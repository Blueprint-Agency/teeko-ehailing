import type { LatLng } from '@teeko/shared';

export type MovementTick = { position: LatLng; heading: number; progress: number };

function bearing(a: LatLng, b: LatLng): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const toDeg = (r: number) => (r * 180) / Math.PI;
  const y = Math.sin(toRad(b.lng - a.lng)) * Math.cos(toRad(b.lat));
  const x =
    Math.cos(toRad(a.lat)) * Math.sin(toRad(b.lat)) -
    Math.sin(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.cos(toRad(b.lng - a.lng));
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

export function simulateDriverMovement(
  polyline: Array<[number, number]>,
  durationMs: number,
  onTick: (tick: MovementTick) => void,
  onDone?: () => void,
): () => void {
  if (polyline.length < 2) {
    onDone?.();
    return () => {};
  }
  const start = Date.now();
  const tickMs = 250;
  const total = polyline.length - 1;

  const interval = setInterval(() => {
    const progress = Math.min(1, (Date.now() - start) / durationMs);
    const fIdx = progress * total;
    const i = Math.min(total - 1, Math.floor(fIdx));
    const t = fIdx - i;
    const a: LatLng = { lat: polyline[i]![0], lng: polyline[i]![1] };
    const b: LatLng = { lat: polyline[i + 1]![0], lng: polyline[i + 1]![1] };
    const position: LatLng = { lat: a.lat + (b.lat - a.lat) * t, lng: a.lng + (b.lng - a.lng) * t };
    onTick({ position, heading: bearing(a, b), progress });
    if (progress >= 1) {
      clearInterval(interval);
      onDone?.();
    }
  }, tickMs);

  return () => clearInterval(interval);
}

// Formatting helpers for route data returned by the Directions API.
// The actual HTTP call lives in @teeko/api (rider) or apps/driver/lib/api (driver),
// so no API key is needed in this package.

export function formatDuration(seconds: number): string {
  const m = Math.round(seconds / 60);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r > 0 ? `${h}h ${r}m` : `${h}h`;
}

export function formatDistance(meters: number): string {
  return meters < 1000 ? `${meters} m` : `${(meters / 1000).toFixed(1)} km`;
}

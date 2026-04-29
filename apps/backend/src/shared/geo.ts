// PostGIS helpers — emit/parse WKT for geography(POINT, 4326).
export type LatLng = { lat: number; lng: number };
export const wktPoint = ({ lat, lng }: LatLng) => `SRID=4326;POINT(${lng} ${lat})`;

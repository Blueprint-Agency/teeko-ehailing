import { customType } from 'drizzle-orm/pg-core';

// PostGIS GEOGRAPHY(POINT, 4326) — stored as WKT string at the boundary.
// Use ST_GeogFromText() / ST_X / ST_Y in queries.
export const geographyPoint = customType<{ data: string; driverData: string }>({
  dataType() {
    return 'geography(POINT, 4326)';
  },
});

export const geographyPolygon = customType<{ data: string; driverData: string }>({
  dataType() {
    return 'geography(POLYGON, 4326)';
  },
});

import { customType } from 'drizzle-orm/pg-core';

// Parse EWKB hex string (what PostGIS/pg returns for geography columns by default)
// into "POINT(lng lat)" WKT that extractPoint() can regex-match.
function ewkbHexToWkt(hex: string): string {
  try {
    const buf = Buffer.from(hex, 'hex');
    const le = buf[0] === 1;
    const type = le ? buf.readUInt32LE(1) : buf.readUInt32BE(1);
    const hasSrid = (type & 0x20000000) !== 0;
    const offset = hasSrid ? 9 : 5; // byte-order(1) + type(4) + [srid(4)]
    const x = le ? buf.readDoubleLE(offset) : buf.readDoubleBE(offset);
    const y = le ? buf.readDoubleLE(offset + 8) : buf.readDoubleBE(offset + 8);
    return `POINT(${x} ${y})`;
  } catch {
    return hex;
  }
}

// PostGIS GEOGRAPHY(POINT, 4326) — written as WKT, read back as EWKB hex.
export const geographyPoint = customType<{ data: string; driverData: string }>({
  dataType() {
    return 'geography(POINT, 4326)';
  },
  fromDriver(value: string): string {
    // pg returns geography columns as EWKB hex (e.g. "0101000020E6100000...").
    // Convert to WKT so extractPoint() can parse lat/lng correctly.
    if (value && /^[0-9a-fA-F]+$/.test(value)) return ewkbHexToWkt(value);
    return value;
  },
});

export const geographyPolygon = customType<{ data: string; driverData: string }>({
  dataType() {
    return 'geography(POLYGON, 4326)';
  },
});

import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/db/schema/*.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'postgres://teeko:teeko@localhost:5500/teeko',
  },
  casing: 'snake_case',
  verbose: true,
  strict: true,
  // PostGIS installs spatial_ref_sys / tiger / topology — keep drizzle blind to them.
  // extensionsFilter makes drizzle-kit ignore objects owned by the postgis
  // extension (spatial_ref_sys, the geography_columns / geometry_columns views),
  // so push/introspect won't try to DROP them — which PostGIS refuses anyway.
  extensionsFilters: ['postgis'],
  schemaFilter: ['public'],
  tablesFilter: ['!spatial_ref_sys'],
});

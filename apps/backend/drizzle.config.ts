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
  schemaFilter: ['public'],
  tablesFilter: ['!spatial_ref_sys'],
});

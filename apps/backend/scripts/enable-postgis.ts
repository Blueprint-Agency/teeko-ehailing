import { sql } from '../src/config/db';

async function main() {
  await sql`CREATE EXTENSION IF NOT EXISTS postgis`;
  console.log('postgis: ready');
  await sql.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

// Drizzle's customType wraps dataType strings in double quotes, treating
// `geography(POINT, 4326)` as a single identifier. PostGIS needs the parens
// unquoted (they're type modifiers). This script unquotes geography(...) types
// in every generated SQL migration.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const dir = 'drizzle';
const re = /"(geography\((?:POINT|POLYGON|LINESTRING|MULTIPOINT|MULTIPOLYGON), \d+\))"/g;

let touched = 0;
for (const f of readdirSync(dir)) {
  if (!f.endsWith('.sql')) continue;
  const path = join(dir, f);
  const before = readFileSync(path, 'utf8');
  const after = before.replace(re, '$1');
  if (before !== after) {
    writeFileSync(path, after);
    touched++;
    console.log(`fixed ${f}`);
  }
}
console.log(`fix-geography: ${touched} file(s) touched`);

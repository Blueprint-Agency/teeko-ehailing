#!/usr/bin/env node
// Generates 0009_snapshot.json by patching 0008 with the surge_zones.active + surge_zones.color columns.
import { readFileSync, writeFileSync } from 'fs';

const base = JSON.parse(readFileSync('./drizzle/meta/0008_snapshot.json', 'utf8'));

const newId  = 'b2d5e3f4-a6c7-489a-9bcd-surgezones009';
const prevId = base.id;

const surge = base.tables['public.surge_zones'];

const snapshot = {
  ...base,
  id: newId,
  prevId,
  tables: {
    ...base.tables,
    'public.surge_zones': {
      ...surge,
      columns: {
        ...surge.columns,
        active: {
          name: 'active',
          type: 'boolean',
          primaryKey: false,
          notNull: true,
          default: true,
        },
        color: {
          name: 'color',
          type: 'text',
          primaryKey: false,
          notNull: false,
        },
      },
    },
  },
};

writeFileSync('./drizzle/meta/0009_snapshot.json', JSON.stringify(snapshot, null, 2));
console.log('✓ drizzle/meta/0009_snapshot.json written');
console.log('  id     :', newId);
console.log('  prevId :', prevId);

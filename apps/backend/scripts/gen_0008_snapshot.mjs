#!/usr/bin/env node
// Generates 0008_snapshot.json by patching 0007 with the commission_configs table + commission_scope enum.
import { readFileSync, writeFileSync } from 'fs';
import { createHash } from 'crypto';

const base = JSON.parse(readFileSync('./drizzle/meta/0007_snapshot.json', 'utf8'));

// Deterministic new UUID derived from the content tag so it's stable across re-runs.
const newId   = 'a1c4d2e3-f5b6-4789-8abc-commission008';
const prevId  = base.id; // 81b2b3de-7219-4416-80a3-c16d4760e2b9

const snapshot = {
  ...base,
  id: newId,
  prevId,

  // ── Add commission_configs table ──────────────────────────────────────────
  tables: {
    ...base.tables,
    'public.commission_configs': {
      name: 'commission_configs',
      schema: '',
      columns: {
        id: {
          name: 'id',
          type: 'uuid',
          primaryKey: true,
          notNull: true,
          default: 'gen_random_uuid()',
        },
        scope: {
          name: 'scope',
          type: 'commission_scope',
          typeSchema: 'public',
          primaryKey: false,
          notNull: true,
        },
        scope_key: {
          name: 'scope_key',
          type: 'text',
          primaryKey: false,
          notNull: true,
        },
        rate_bps: {
          name: 'rate_bps',
          type: 'integer',
          primaryKey: false,
          notNull: true,
        },
        note: {
          name: 'note',
          type: 'text',
          primaryKey: false,
          notNull: false,
        },
        updated_by: {
          name: 'updated_by',
          type: 'uuid',
          primaryKey: false,
          notNull: false,
        },
        updated_at: {
          name: 'updated_at',
          type: 'timestamp with time zone',
          primaryKey: false,
          notNull: true,
          default: 'now()',
        },
        created_at: {
          name: 'created_at',
          type: 'timestamp with time zone',
          primaryKey: false,
          notNull: true,
          default: 'now()',
        },
      },
      indexes: {},
      foreignKeys: {
        commission_configs_updated_by_users_id_fk: {
          name: 'commission_configs_updated_by_users_id_fk',
          tableFrom: 'commission_configs',
          tableTo: 'users',
          columnsFrom: ['updated_by'],
          columnsTo: ['id'],
          onDelete: 'no action',
          onUpdate: 'no action',
        },
      },
      compositePrimaryKeys: {},
      uniqueConstraints: {
        uq_commission_scope_key: {
          name: 'uq_commission_scope_key',
          nullsNotDistinct: false,
          columns: ['scope', 'scope_key'],
        },
      },
      policies: {},
      checkConstraints: {},
      isRLSEnabled: false,
    },
  },

  // ── Add commission_scope enum ─────────────────────────────────────────────
  enums: {
    ...base.enums,
    'public.commission_scope': {
      name: 'commission_scope',
      schema: 'public',
      values: ['platform', 'category', 'driver'],
    },
  },
};

writeFileSync('./drizzle/meta/0008_snapshot.json', JSON.stringify(snapshot, null, 2));
console.log('✓ drizzle/meta/0008_snapshot.json written');
console.log('  id     :', newId);
console.log('  prevId :', prevId);

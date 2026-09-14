import type { FastifyInstance } from 'fastify';
import { asc, eq, sql } from 'drizzle-orm';
import { db } from '../../config/db';
import { surgeConfig, surgeZones } from '../../db/schema/pricing-incentives';
import { recordAuditSafe } from '../../modules/admin/audit';

type LatLng = { lat: number; lng: number };

// PostGIS polygons are stored as geography and read back as opaque EWKB hex, so
// we ask Postgres to render GeoJSON and pull the outer ring out of that. The map
// only needs the boundary; holes (inner rings) aren't used by surge zones.
const polygonGeoJson = (col: typeof surgeZones.polygon) =>
  sql<string | null>`ST_AsGeoJSON(${col})`;

// GeoJSON Polygon coordinates are [[[lng, lat], ...]] with the outer ring first;
// Google Maps wants { lat, lng }. Returns [] on any missing/unparseable value.
function parsePolygon(geojson: string | null): LatLng[] {
  if (!geojson) return [];
  try {
    const ring = JSON.parse(geojson)?.coordinates?.[0];
    if (!Array.isArray(ring)) return [];
    return ring.map(([lng, lat]: [number, number]) => ({ lat, lng }));
  } catch {
    return [];
  }
}

// ── Constants ────────────────────────────────────────────────────────────────
const MIN_MULTIPLIER = 1.0;
const MAX_MULTIPLIER = 3.0;

/**
 * How long an admin override holds before the zone reverts to the worker's
 * computed rate. Time-boxed on purpose: an override set during a downpour and
 * then forgotten would otherwise pin that zone's pricing indefinitely.
 */
const DEFAULT_OVERRIDE_MINUTES = 60;
const MIN_OVERRIDE_MINUTES = 5;
const MAX_OVERRIDE_MINUTES = 24 * 60;

// ── Helpers ───────────────────────────────────────────────────────────────────
function validateMultiplier(
  value: unknown,
): { multiplier: number } | { error: string; message: string } {
  if (typeof value !== 'number' || isNaN(value)) {
    return { error: 'multiplier_required', message: 'multiplier must be a number' };
  }
  if (value < MIN_MULTIPLIER || value > MAX_MULTIPLIER) {
    return {
      error: 'multiplier_out_of_range',
      message: `Multiplier must be between ${MIN_MULTIPLIER}× and ${MAX_MULTIPLIER}×`,
    };
  }
  return { multiplier: value };
}

type ZoneRow = typeof surgeZones.$inferSelect;

/**
 * The rate riders actually get, mirroring the resolution in
 * `modules/pricing/service.ts`: an unexpired admin override wins over the
 * worker's computed value.
 */
function effectiveMultiplier(row: Pick<ZoneRow, 'manualMultiplier' | 'manualUntil' | 'autoMultiplier'>) {
  const overrideLive =
    row.manualMultiplier !== null && row.manualUntil !== null && row.manualUntil > new Date();
  if (overrideLive) return { value: parseFloat(row.manualMultiplier!), source: 'manual' as const };
  if (row.autoMultiplier !== null) return { value: parseFloat(row.autoMultiplier), source: 'auto' as const };
  return { value: MIN_MULTIPLIER, source: 'default' as const };
}

function serialize(row: ZoneRow, polygon: LatLng[] = []) {
  const effective = effectiveMultiplier(row);
  return {
    id: row.id,
    name: row.label,
    // `multiplier` stays the effective rate so existing panel code keeps working.
    multiplier: effective.value,
    source: effective.source,
    autoMultiplier: row.autoMultiplier === null ? null : parseFloat(row.autoMultiplier),
    manualMultiplier: row.manualMultiplier === null ? null : parseFloat(row.manualMultiplier),
    manualUntil: row.manualUntil?.toISOString() ?? null,
    active: row.active,
    color: row.color,
    // Outer-ring coordinates for rendering the zone on the admin surge map.
    polygon,
  };
}

// The general/base surge multiplier lives in the `surge_config` singleton
// (id = 1). `lookupSurgeMultiplier` in modules/pricing/service.ts falls back to
// it for any pickup a surge zone doesn't cover — so zones override this rate.
const SURGE_CONFIG_ID = 1;

// ── Routes ────────────────────────────────────────────────────────────────────
export async function routes(app: FastifyInstance) {
  // ── GET /surge/config ──────────────────────────────────────────────────────
  // The general KL surge rate — the base multiplier applied wherever no active
  // zone covers the pickup. Zones (below) override it.
  app.get('/config', async () => {
    const row = await db.query.surgeConfig.findFirst({ where: eq(surgeConfig.id, SURGE_CONFIG_ID) });
    return {
      multiplier: row ? parseFloat(row.multiplier) : MIN_MULTIPLIER,
      updatedAt: row?.updatedAt?.toISOString() ?? null,
    };
  });

  // ── PUT /surge/config ──────────────────────────────────────────────────────
  // Set the general KL surge multiplier. 1.0× means no general surge (zones can
  // still surge their own areas).
  app.put<{ Body: { multiplier?: number } }>('/config', async (req, reply) => {
    const validated = validateMultiplier(req.body?.multiplier);
    if ('error' in validated) return reply.code(400).send(validated);

    const value = validated.multiplier.toFixed(2);
    const [row] = await db
      .insert(surgeConfig)
      .values({ id: SURGE_CONFIG_ID, multiplier: value, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: surgeConfig.id,
        set: { multiplier: value, updatedAt: new Date() },
      })
      .returning();

    await recordAuditSafe(req, {
      action: 'update_surge',
      targetType: 'surge_config',
      targetId: String(SURGE_CONFIG_ID),
      targetName: 'General KL surge',
      details: `General KL surge multiplier set to ${validated.multiplier}×`,
      payload: { multiplier: validated.multiplier },
    });

    return {
      ok: true,
      config: { multiplier: parseFloat(row!.multiplier), updatedAt: row!.updatedAt.toISOString() },
    };
  });

  // ── GET /surge/zones ───────────────────────────────────────────────────────
  // List all surge zones with their multiplier, active state and render colour.
  app.get('/zones', async () => {
    const rows = await db
      .select({ zone: surgeZones, polygon: polygonGeoJson(surgeZones.polygon) })
      .from(surgeZones)
      .orderBy(asc(surgeZones.label));
    return rows.map((r) => serialize(r.zone, parsePolygon(r.polygon)));
  });

  // ── PUT /surge/zones/:id ───────────────────────────────────────────────────
  // Set or clear a zone's admin override, and/or toggle it active.
  //
  // `multiplier: <number>` sets a time-boxed override (see overrideMinutes).
  // `multiplier: null` releases the zone back to the worker's computed rate.
  // The worker's `auto_multiplier` is never written here.
  app.put<{
    Params: { id: string };
    Body: { multiplier?: number | null; active?: boolean; overrideMinutes?: number };
  }>(
    '/zones/:id',
    async (req, reply) => {
      const { id } = req.params;
      const { multiplier, active, overrideMinutes } = req.body ?? {};

      const set: Partial<Pick<ZoneRow, 'manualMultiplier' | 'manualUntil' | 'active'>> = {};

      if (multiplier === null) {
        // Release back to auto.
        set.manualMultiplier = null;
        set.manualUntil = null;
      } else if (multiplier !== undefined) {
        const validated = validateMultiplier(multiplier);
        if ('error' in validated) return reply.code(400).send(validated);

        const minutes = overrideMinutes ?? DEFAULT_OVERRIDE_MINUTES;
        if (
          typeof minutes !== 'number' ||
          !Number.isFinite(minutes) ||
          minutes < MIN_OVERRIDE_MINUTES ||
          minutes > MAX_OVERRIDE_MINUTES
        ) {
          return reply.code(400).send({
            error: 'invalid_override_minutes',
            message: `overrideMinutes must be between ${MIN_OVERRIDE_MINUTES} and ${MAX_OVERRIDE_MINUTES}`,
          });
        }

        set.manualMultiplier = validated.multiplier.toFixed(2);
        set.manualUntil = new Date(Date.now() + minutes * 60_000);
      }

      if (active !== undefined) {
        if (typeof active !== 'boolean') {
          return reply.code(400).send({ error: 'invalid_active', message: 'active must be a boolean' });
        }
        set.active = active;
      }

      if (Object.keys(set).length === 0) {
        return reply.code(400).send({ error: 'no_changes', message: 'Provide multiplier and/or active' });
      }

      const [row] = await db
        .update(surgeZones)
        .set(set)
        .where(eq(surgeZones.id, id))
        .returning();

      if (!row) return reply.code(404).send({ error: 'zone_not_found' });

      // The `returning()` geography column is opaque EWKB; re-read it as GeoJSON
      // so the panel (which swaps in the whole returned zone) keeps its polygon.
      const [geo] = await db
        .select({ polygon: polygonGeoJson(surgeZones.polygon) })
        .from(surgeZones)
        .where(eq(surgeZones.id, id));

      // Describe exactly what the admin changed for the audit trail.
      const changes: string[] = [];
      if (multiplier === null) changes.push('override released (back to auto)');
      else if (multiplier !== undefined) changes.push(`multiplier set to ${multiplier}×`);
      if (active !== undefined) changes.push(active ? 'activated' : 'deactivated');

      await recordAuditSafe(req, {
        action: 'update_surge',
        targetType: 'surge_zone',
        targetId: id,
        targetName: row.label,
        details: `Surge zone ${changes.join(', ') || 'updated'}`,
        payload: { multiplier: multiplier ?? null, active: active ?? null, overrideMinutes: overrideMinutes ?? null },
      });

      return { ok: true, zone: serialize(row, parsePolygon(geo?.polygon ?? null)) };
    },
  );
}

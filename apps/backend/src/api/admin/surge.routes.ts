import type { FastifyInstance } from 'fastify';
import { asc, eq } from 'drizzle-orm';
import { db } from '../../config/db';
import { surgeZones } from '../../db/schema/pricing-incentives';

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

function serialize(row: ZoneRow) {
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
  };
}

// ── Routes ────────────────────────────────────────────────────────────────────
export async function routes(app: FastifyInstance) {
  // ── GET /surge/zones ───────────────────────────────────────────────────────
  // List all surge zones with their multiplier, active state and render colour.
  app.get('/zones', async () => {
    const rows = await db.select().from(surgeZones).orderBy(asc(surgeZones.label));
    return rows.map(serialize);
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

      return { ok: true, zone: serialize(row) };
    },
  );
}

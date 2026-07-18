import type { FastifyInstance } from 'fastify';
import { asc, eq } from 'drizzle-orm';
import { db } from '../../config/db';
import { surgeZones } from '../../db/schema/pricing-incentives';

// ── Constants ────────────────────────────────────────────────────────────────
const MIN_MULTIPLIER = 1.0;
const MAX_MULTIPLIER = 3.0;

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

function serialize(row: ZoneRow) {
  return {
    id: row.id,
    name: row.label,
    multiplier: parseFloat(row.multiplier),
    active: row.active,
    color: row.color,
  };
}

// ── Routes ────────────────────────────────────────────────────────────────────
export async function routes(app: FastifyInstance) {
  // ── GET /surge/zones ───────────────────────────────────────────────────────
  // List all surge zones with their multiplier, active state and render colour.
  app.get('/zones', async () => {
    const rows = await db
      .select({
        id: surgeZones.id,
        label: surgeZones.label,
        multiplier: surgeZones.multiplier,
        active: surgeZones.active,
        color: surgeZones.color,
      })
      .from(surgeZones)
      .orderBy(asc(surgeZones.label));

    return rows.map((r) => ({
      id: r.id,
      name: r.label,
      multiplier: parseFloat(r.multiplier),
      active: r.active,
      color: r.color,
    }));
  });

  // ── PUT /surge/zones/:id ───────────────────────────────────────────────────
  // Update a zone's multiplier and/or active state.
  app.put<{ Params: { id: string }; Body: { multiplier?: number; active?: boolean } }>(
    '/zones/:id',
    async (req, reply) => {
      const { id } = req.params;
      const { multiplier, active } = req.body ?? {};

      const set: Partial<Pick<ZoneRow, 'multiplier' | 'active'>> = {};

      if (multiplier !== undefined) {
        const validated = validateMultiplier(multiplier);
        if ('error' in validated) return reply.code(400).send(validated);
        set.multiplier = validated.multiplier.toFixed(2);
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

import type { FastifyInstance } from 'fastify';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { db } from '../../config/db';
import { commissionConfigs } from '../../db/schema/pricing-incentives';
import { driverProfiles, vehicles } from '../../db/schema/drivers';
import { users } from '../../db/schema/identity';

// ── Constants ────────────────────────────────────────────────────────────────
const PLATFORM_KEY = '__platform__';
const DEFAULT_RATE_BPS = 2000; // 20% — fallback if the DB row is missing
const MIN_RATE_BPS = 500;      // 5%
const MAX_RATE_BPS = 4000;     // 40%

const ALL_CATEGORIES = ['go', 'comfort', 'xl', 'premium', 'bike'] as const;
type RideCategory = (typeof ALL_CATEGORIES)[number];

// ── Helpers ───────────────────────────────────────────────────────────────────
function bpsToPercent(bps: number) {
  return bps / 100;
}

function percentToBps(pct: number) {
  return Math.round(pct * 100);
}

function validateRate(rate: unknown): { bps: number } | { error: string; message: string } {
  if (typeof rate !== 'number' || isNaN(rate)) return { error: 'rate_required', message: 'rate must be a number' };
  const bps = percentToBps(rate);
  if (bps < MIN_RATE_BPS || bps > MAX_RATE_BPS) {
    return {
      error: 'rate_out_of_range',
      message: `Rate must be between ${bpsToPercent(MIN_RATE_BPS)}% and ${bpsToPercent(MAX_RATE_BPS)}%`,
    };
  }
  return { bps };
}

/** Load all commission_configs rows and return a Map keyed by `scope:scopeKey`. */
async function loadAllConfigs() {
  const rows = await db.select().from(commissionConfigs);
  return new Map(rows.map((r) => [`${r.scope}:${r.scopeKey}`, r]));
}

/** Resolve the effective rate for a (driverId, category) pair from an already-loaded config map. */
function resolveRate(
  map: Map<string, { rateBps: number }>,
  driverId: string,
  category: string,
): { rateBps: number; source: 'driver' | 'category' | 'platform' } {
  const driverRow = map.get(`driver:${driverId}`);
  if (driverRow) return { rateBps: driverRow.rateBps, source: 'driver' };

  const catRow = map.get(`category:${category}`);
  if (catRow) return { rateBps: catRow.rateBps, source: 'category' };

  const platformRow = map.get(`platform:${PLATFORM_KEY}`);
  return { rateBps: platformRow?.rateBps ?? DEFAULT_RATE_BPS, source: 'platform' };
}

// ── Routes ────────────────────────────────────────────────────────────────────
export async function routes(app: FastifyInstance) {
  // ── GET /commissions/settings ─────────────────────────────────────────────
  // Returns the full tiered config: platform rate, all category configs,
  // and all driver-level overrides.
  app.get('/settings', async () => {
    const configMap = await loadAllConfigs();

    const platformRow = configMap.get(`platform:${PLATFORM_KEY}`);
    const platformRateBps = platformRow?.rateBps ?? DEFAULT_RATE_BPS;

    // Category rows — include all categories, defaulting to the platform rate when no override exists.
    const categories = ALL_CATEGORIES.map((cat) => {
      const row = configMap.get(`category:${cat}`);
      return {
        category: cat,
        rateBps: row?.rateBps ?? platformRateBps,
        rate: bpsToPercent(row?.rateBps ?? platformRateBps),
        isOverride: Boolean(row),
      };
    });

    // Driver overrides — all rows with scope='driver'.
    const driverOverrideRows = [...configMap.values()].filter((r) => r.scope === 'driver');
    const driverIds = driverOverrideRows.map((r) => r.scopeKey);

    let driverDetails: Array<{ id: string; name: string; category: string }> = [];
    if (driverIds.length > 0) {
      const rows = await db
        .select({
          driverId: driverProfiles.userId,
          name: users.fullName,
          category: vehicles.category,
        })
        .from(driverProfiles)
        .leftJoin(users, eq(users.id, driverProfiles.userId))
        .leftJoin(vehicles, eq(vehicles.driverId, driverProfiles.userId))
        .where(inArray(driverProfiles.userId, driverIds));

      driverDetails = rows.map((r) => ({
        id: r.driverId,
        name: r.name ?? '—',
        category: r.category ?? '—',
      }));
    }

    const driverOverrides = driverOverrideRows.map((r) => {
      const details = driverDetails.find((d) => d.id === r.scopeKey);
      return {
        driverId: r.scopeKey,
        name: details?.name ?? '—',
        category: details?.category ?? '—',
        rateBps: r.rateBps,
        rate: bpsToPercent(r.rateBps),
        note: r.note,
        updatedAt: r.updatedAt,
      };
    });

    return {
      platform: { rateBps: platformRateBps, rate: bpsToPercent(platformRateBps) },
      categories,
      driverOverrides,
    };
  });

  // ── GET /commissions/drivers ──────────────────────────────────────────────
  // Returns all drivers with their effective commission rate resolved across
  // all three tiers: driver > category > platform.
  app.get('/drivers', async () => {
    const [configMap, driverRows] = await Promise.all([
      loadAllConfigs(),
      db
        .select({
          driverId: driverProfiles.userId,
          name: users.fullName,
          category: vehicles.category,
          totalTrips: driverProfiles.totalTrips,
        })
        .from(driverProfiles)
        .leftJoin(users, eq(users.id, driverProfiles.userId))
        .leftJoin(vehicles, eq(vehicles.driverId, driverProfiles.userId))
        .orderBy(desc(users.fullName)),
    ]);

    return driverRows.map((r) => {
      const { rateBps, source } = resolveRate(configMap, r.driverId, r.category ?? '');
      return {
        id: r.driverId,
        name: r.name ?? '—',
        category: r.category ?? '—',
        trips: r.totalTrips ?? 0,
        rate: bpsToPercent(rateBps),
        rateBps,
        source, // 'driver' | 'category' | 'platform'
      };
    });
  });

  // ── PUT /commissions/platform ─────────────────────────────────────────────
  // Upsert the platform-wide default rate.
  app.put<{ Body: { rate: number; note?: string } }>('/platform', async (req, reply) => {
    const { rate, note } = req.body ?? {};
    const validated = validateRate(rate);
    if ('error' in validated) return reply.code(400).send(validated);

    const { bps } = validated;
    const now = new Date();
    const updatedBy = req.user?.id ?? null;

    await db
      .insert(commissionConfigs)
      .values({ scope: 'platform', scopeKey: PLATFORM_KEY, rateBps: bps, note: note ?? null, updatedBy, updatedAt: now })
      .onConflictDoUpdate({
        target: [commissionConfigs.scope, commissionConfigs.scopeKey],
        set: { rateBps: bps, note: note ?? null, updatedBy, updatedAt: now },
      });

    return { ok: true, rate, rateBps: bps };
  });

  // ── PUT /commissions/categories/:category ────────────────────────────────
  // Upsert a category-level override.
  app.put<{ Params: { category: string }; Body: { rate: number; note?: string } }>(
    '/categories/:category',
    async (req, reply) => {
      const { category } = req.params;
      if (!ALL_CATEGORIES.includes(category as RideCategory)) {
        return reply.code(400).send({ error: 'invalid_category', validCategories: ALL_CATEGORIES });
      }

      const { rate, note } = req.body ?? {};
      const validated = validateRate(rate);
      if ('error' in validated) return reply.code(400).send(validated);

      const { bps } = validated;
      const now = new Date();
      const updatedBy = req.user?.id ?? null;

      await db
        .insert(commissionConfigs)
        .values({ scope: 'category', scopeKey: category, rateBps: bps, note: note ?? null, updatedBy, updatedAt: now })
        .onConflictDoUpdate({
          target: [commissionConfigs.scope, commissionConfigs.scopeKey],
          set: { rateBps: bps, note: note ?? null, updatedBy, updatedAt: now },
        });

      return { ok: true, category, rate, rateBps: bps };
    },
  );

  // ── DELETE /commissions/categories/:category ─────────────────────────────
  // Remove a category override so it falls back to the platform rate.
  app.delete<{ Params: { category: string } }>('/categories/:category', async (req, reply) => {
    const { category } = req.params;
    if (!ALL_CATEGORIES.includes(category as RideCategory)) {
      return reply.code(400).send({ error: 'invalid_category' });
    }

    await db
      .delete(commissionConfigs)
      .where(and(eq(commissionConfigs.scope, 'category'), eq(commissionConfigs.scopeKey, category)));

    return { ok: true, category, clearedToDefault: true };
  });

  // ── PUT /commissions/drivers/:driverId ───────────────────────────────────
  // Upsert a driver-level override.
  app.put<{ Params: { driverId: string }; Body: { rate: number; note?: string } }>(
    '/drivers/:driverId',
    async (req, reply) => {
      const { driverId } = req.params;
      const { rate, note } = req.body ?? {};

      const driver = await db.query.driverProfiles.findFirst({
        where: eq(driverProfiles.userId, driverId),
      });
      if (!driver) return reply.code(404).send({ error: 'driver_not_found' });

      const validated = validateRate(rate);
      if ('error' in validated) return reply.code(400).send(validated);

      const { bps } = validated;
      const now = new Date();
      const updatedBy = req.user?.id ?? null;

      await db
        .insert(commissionConfigs)
        .values({ scope: 'driver', scopeKey: driverId, rateBps: bps, note: note ?? null, updatedBy, updatedAt: now })
        .onConflictDoUpdate({
          target: [commissionConfigs.scope, commissionConfigs.scopeKey],
          set: { rateBps: bps, note: note ?? null, updatedBy, updatedAt: now },
        });

      return { ok: true, driverId, rate, rateBps: bps };
    },
  );

  // ── DELETE /commissions/drivers/:driverId ────────────────────────────────
  // Remove a driver override so they fall back to category or platform rate.
  app.delete<{ Params: { driverId: string } }>('/drivers/:driverId', async (req, reply) => {
    const { driverId } = req.params;

    await db
      .delete(commissionConfigs)
      .where(and(eq(commissionConfigs.scope, 'driver'), eq(commissionConfigs.scopeKey, driverId)));

    return { ok: true, driverId, clearedToDefault: true };
  });
}

// Surge recompute (spec §pricing). Recomputes each active zone's demand-driven
// multiplier from live trip requests vs available drivers and writes it to
// `surge_zones.auto_multiplier`.
//
// It never writes `manual_multiplier` — an admin override, while unexpired,
// outranks whatever this computes (see modules/pricing/service.ts). The auto
// value is still refreshed for overridden zones so there is a current rate
// waiting when the override lapses.
//
// v0.1 wires the *logic* (callable + testable); scheduling via BullMQ/Cloud
// Scheduler lands in v1.0, matching reconcile.worker.ts.

import { and, eq, gte, sql } from 'drizzle-orm';

import { db } from '../config/db';
import { logger } from '../config/logger';
import { driverLocations, driverProfiles } from '../db/schema/drivers';
import { surgeZones } from '../db/schema/pricing-incentives';
import { trips } from '../db/schema/trips';

/** Mirrors the bounds the admin UI and pricing engine both enforce. */
const SURGE_MIN = 1.0;
const SURGE_MAX = 3.0;

/** Demand is counted over this trailing window. */
const DEMAND_WINDOW_MINUTES = 15;

/**
 * A driver ping older than this is treated as stale — the driver is likely
 * offline or out of coverage, and counting them would understate surge.
 */
const LOCATION_FRESHNESS_MINUTES = 5;

/**
 * Largest change allowed in one pass. Without it a single burst of requests
 * whips a zone from 1.0x to 3.0x and back, and riders see the price of the
 * same trip swing between refreshes.
 */
const MAX_STEP = 0.3;

/**
 * demand-to-supply ratio → target multiplier. Deliberately coarse and capped
 * well under SURGE_MAX: this is a pricing lever with real passenger impact, so
 * the aggressive end stays a human decision via the admin override.
 */
const RATIO_STEPS: ReadonlyArray<{ ratio: number; multiplier: number }> = [
  { ratio: 4.0, multiplier: 2.0 },
  { ratio: 3.0, multiplier: 1.8 },
  { ratio: 2.0, multiplier: 1.5 },
  { ratio: 1.5, multiplier: 1.3 },
  { ratio: 1.0, multiplier: 1.2 },
  { ratio: 0.5, multiplier: 1.1 },
];

function clamp(value: number): number {
  if (!Number.isFinite(value)) return SURGE_MIN;
  return Math.min(SURGE_MAX, Math.max(SURGE_MIN, value));
}

/** Round to one decimal — riders see "1.3x", not "1.2847x". */
function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

export function targetMultiplier(demand: number, supply: number): number {
  if (demand === 0) return SURGE_MIN;
  // No drivers at all but live demand is the strongest signal there is; treat
  // it as the top of the ladder rather than dividing by zero.
  const ratio = supply === 0 ? Number.POSITIVE_INFINITY : demand / supply;
  const step = RATIO_STEPS.find((s) => ratio >= s.ratio);
  return step ? step.multiplier : SURGE_MIN;
}

/**
 * Ease from the current rate toward the target so pricing moves gradually.
 * Returns a value rounded to 0.1 and clamped to the allowed band.
 */
export function easeToward(current: number, target: number): number {
  const delta = target - current;
  const stepped = Math.abs(delta) <= MAX_STEP ? target : current + Math.sign(delta) * MAX_STEP;
  return clamp(round1(stepped));
}

type ZoneLoad = { id: string; label: string; current: number; demand: number; supply: number };

/**
 * Per-zone demand and supply in one pass. Demand counts trip requests whose
 * pickup falls in the zone over the trailing window; supply counts drivers
 * currently idle-and-online with a fresh ping inside the zone. Both are
 * PostGIS point-in-polygon — there is no precomputed zone-metrics table.
 */
export async function collectZoneLoad(): Promise<ZoneLoad[]> {
  const now = new Date();
  const demandSince = new Date(now.getTime() - DEMAND_WINDOW_MINUTES * 60_000);
  const locationSince = new Date(now.getTime() - LOCATION_FRESHNESS_MINUTES * 60_000);

  const rows = await db
    .select({
      id: surgeZones.id,
      label: surgeZones.label,
      autoMultiplier: surgeZones.autoMultiplier,
      demand: sql<number>`(
        SELECT count(*) FROM ${trips}
        WHERE ${trips.createdAt} >= ${demandSince}
          AND ST_Covers(${surgeZones.polygon}, ${trips.pickup})
      )`,
      supply: sql<number>`(
        SELECT count(*) FROM ${driverLocations}
        JOIN ${driverProfiles} ON ${driverProfiles.userId} = ${driverLocations.driverId}
        WHERE ${driverProfiles.availability} = 'online'
          AND ${driverLocations.recordedAt} >= ${locationSince}
          AND ST_Covers(${surgeZones.polygon}, ${driverLocations.location})
      )`,
    })
    .from(surgeZones)
    .where(
      and(
        eq(surgeZones.active, true),
        sql`${surgeZones.activeFrom} <= ${now}`,
        gte(surgeZones.activeUntil, now),
      ),
    );

  return rows.map((r) => ({
    id: r.id,
    label: r.label,
    current: r.autoMultiplier === null ? SURGE_MIN : clamp(parseFloat(r.autoMultiplier)),
    demand: Number(r.demand ?? 0),
    supply: Number(r.supply ?? 0),
  }));
}

/**
 * One recompute pass. Returns the number of zones whose auto rate changed.
 * A failure on one zone is logged and skipped so the rest of the pass still
 * lands, matching reconcile.worker.ts.
 */
export async function runSurgeRecompute(): Promise<number> {
  const zones = await collectZoneLoad();
  let updated = 0;

  for (const zone of zones) {
    const target = targetMultiplier(zone.demand, zone.supply);
    const next = easeToward(zone.current, target);
    if (next === zone.current) continue;

    try {
      await db
        .update(surgeZones)
        .set({ autoMultiplier: next.toFixed(2) })
        .where(eq(surgeZones.id, zone.id));
      updated += 1;
      logger.info(
        { zone: zone.label, demand: zone.demand, supply: zone.supply, from: zone.current, to: next },
        'surge zone auto multiplier updated',
      );
    } catch (err) {
      logger.error({ err, zoneId: zone.id }, 'surge recompute failed for zone');
    }
  }

  logger.info({ zones: zones.length, updated }, 'surge recompute pass complete');
  return updated;
}

export const surgeRecomputeWorker = { run: runSurgeRecompute };

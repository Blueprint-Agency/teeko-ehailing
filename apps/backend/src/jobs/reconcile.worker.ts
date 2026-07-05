// Reconciliation job (spec §15). Because the charge is off-session and async,
// this closes the gap between our ledger and the processor. Intended to run
// nightly (Cloud Scheduler → Cloud Run job, 03:00 MYT) and also backs the
// on-demand `sync-payment` recovery.
//
// v0.1 wires the *logic* (callable + tested against mocks); scheduling via
// BullMQ/Cloud Scheduler lands in v1.0.

import { and, eq, isNull, lt, sql } from 'drizzle-orm';

import { db } from '../config/db';
import { logger } from '../config/logger';
import { payments } from '../db/schema/payments';
import { trips } from '../db/schema/trips';
import { paymentsService } from '../modules/payments/service';

/**
 * Completed trips with no payment row at all — a crash between complete and
 * charge (spec §15.3). Charge them now (idempotent: chargeTripFare writes a
 * fresh ledger row; earnings unique(trip_id) prevents a double credit).
 */
export async function chargeUnbilledCompletedTrips(): Promise<number> {
  const rows = await db
    .select({
      id: trips.id,
      riderId: trips.riderId,
      driverId: trips.driverId,
      paymentMethodId: trips.paymentMethodId,
      category: trips.category,
      finalFareCents: trips.finalFareCents,
    })
    .from(trips)
    .leftJoin(payments, eq(payments.tripId, trips.id))
    .where(and(eq(trips.status, 'completed'), isNull(payments.id)));

  let charged = 0;
  for (const t of rows) {
    if (t.finalFareCents == null) continue;
    await paymentsService
      .chargeTripFare(
        {
          id: t.id,
          riderId: t.riderId,
          driverId: t.driverId,
          paymentMethodId: t.paymentMethodId,
          category: t.category,
        },
        t.finalFareCents,
      )
      .then(() => {
        charged += 1;
      })
      .catch((err) => logger.error({ err, tripId: t.id }, 'reconcile charge failed'));
  }
  return charged;
}

/**
 * Payments stuck in 'pending' for over 15 minutes (spec §15.1). In v1.0 this
 * re-queries the Stripe PaymentIntent and resolves the row; here it surfaces
 * them for visibility so nothing silently rots.
 */
export async function findStalePendingPayments(): Promise<number> {
  const cutoff = new Date(Date.now() - 15 * 60_000);
  const rows = await db
    .select({ count: sql<number>`count(*)` })
    .from(payments)
    .where(and(eq(payments.status, 'pending'), lt(payments.createdAt, cutoff)));
  const stale = Number(rows[0]?.count ?? 0);
  if (stale > 0) logger.warn({ stale }, 'reconcile: stale pending payments need Stripe sync');
  return stale;
}

/** On-demand idempotent recovery for a single trip (spec §15 sync-payment). */
export async function syncTripPayment(tripId: string): Promise<{ charged: boolean }> {
  const existing = await db.query.payments.findFirst({ where: eq(payments.tripId, tripId) });
  if (existing) return { charged: false };
  const trip = await db.query.trips.findFirst({ where: eq(trips.id, tripId) });
  if (!trip || trip.status !== 'completed' || trip.finalFareCents == null) {
    return { charged: false };
  }
  await paymentsService.chargeTripFare(
    {
      id: trip.id,
      riderId: trip.riderId,
      driverId: trip.driverId,
      paymentMethodId: trip.paymentMethodId,
      category: trip.category,
    },
    trip.finalFareCents,
  );
  return { charged: true };
}

export async function runReconciliation(): Promise<void> {
  const charged = await chargeUnbilledCompletedTrips();
  const stale = await findStalePendingPayments();
  logger.info({ charged, stale }, 'reconciliation pass complete');
}

export const reconcileWorker = { run: runReconciliation };

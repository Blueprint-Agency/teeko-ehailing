import type { FastifyInstance } from 'fastify';
import { and, asc, eq, gte, inArray, isNull, lt, sql } from 'drizzle-orm';

import { db } from '../../config/db';
import { requireRole } from '../../http/middleware/requireRole';
import { trips } from '../../db/schema/trips';
import { driverEarnings, driverBankAccounts, payouts } from '../../db/schema/payments';
import { users } from '../../db/schema/identity';

// Payouts are computed on the Malaysian calendar — a trip completed at 01:00
// MYT belongs to that day, not the previous UTC one. Same reasoning (and the
// same GROUP BY caveat) as revenue.routes.ts.
const TZ = 'Asia/Kuala_Lumpur';

const rm = (cents: number | null) => Number(cents ?? 0) / 100;

/** Full account numbers leave the server only on the finance export. */
const maskAccount = (accountNumber: string | null) =>
  accountNumber ? `••••${accountNumber.slice(-4)}` : null;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * A KL calendar date range → the UTC instants bounding it. `end` is inclusive,
 * so it resolves to the start of the following day.
 */
function rangeToUtc(start: string, end: string): { from: Date; to: Date } {
  const [lo, hi] = start <= end ? [start, end] : [end, start];
  return {
    from: new Date(`${lo}T00:00:00+08:00`),
    to: new Date(new Date(`${hi}T00:00:00+08:00`).getTime() + 86_400_000),
  };
}

function parseRange(query: { start?: string; end?: string }) {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date());
  const start = DATE_RE.test(query.start ?? '') ? query.start! : today;
  const end = DATE_RE.test(query.end ?? '') ? query.end! : today;
  return { start, end, ...rangeToUtc(start, end) };
}

export async function routes(app: FastifyInstance) {
  // ── GET /payouts/sheet?start=YYYY-MM-DD&end=YYYY-MM-DD ─────────────────────
  // One row per driver with completed trips in the range: what they earned, the
  // commission Teeko kept, and the bank account finance transfers to. Amounts
  // come from `driver_earnings` (the per-trip mirror written at completion), so
  // the payout total is the ledger's net, never a re-derived fare minus rate.
  //
  // A driver who hasn't registered a bank account still appears — they have
  // earned the money and finance needs to see who is unpayable.
  app.get<{ Querystring: { start?: string; end?: string } }>('/sheet', async (req) => {
    const { start, end, from, to } = parseRange(req.query);

    const rows = await db
      .select({
        driverId: driverEarnings.driverId,
        driverName: users.fullName,
        bankName: driverBankAccounts.bankName,
        accountHolderName: driverBankAccounts.accountHolderName,
        accountNumber: driverBankAccounts.accountNumber,
        tripCount: sql<number>`count(*)`,
        grossCents: sql<number>`coalesce(sum(${driverEarnings.grossCents}), 0)`,
        commissionCents: sql<number>`coalesce(sum(${driverEarnings.commissionCents}), 0)`,
        netCents: sql<number>`coalesce(sum(${driverEarnings.netCents}), 0)`,
      })
      .from(driverEarnings)
      .innerJoin(trips, eq(trips.id, driverEarnings.tripId))
      .leftJoin(users, eq(users.id, driverEarnings.driverId))
      .leftJoin(driverBankAccounts, eq(driverBankAccounts.driverId, driverEarnings.driverId))
      .where(
        and(
          eq(trips.status, 'completed'),
          gte(trips.completedAt, from),
          lt(trips.completedAt, to),
          // Already-paid earnings drop out, so a range can never be paid twice
          // and the sheet always reads as "what is still owed".
          isNull(driverEarnings.payoutId),
        ),
      )
      .groupBy(
        driverEarnings.driverId,
        users.fullName,
        driverBankAccounts.bankName,
        driverBankAccounts.accountHolderName,
        driverBankAccounts.accountNumber,
      );

    const sheet = rows
      .map((r) => ({
        driverId: r.driverId,
        driverName: r.driverName ?? r.driverId,
        bank: r.bankName,
        accountHolderName: r.accountHolderName,
        account: maskAccount(r.accountNumber),
        // False until the driver registers an account in the app — the row is
        // still listed, but it can't be paid.
        hasBankAccount: !!r.accountNumber,
        tripCount: Number(r.tripCount),
        gross: rm(r.grossCents),
        commission: rm(r.commissionCents),
        amount: rm(r.netCents),
      }))
      .sort((a, b) => b.amount - a.amount);

    return { period: { start, end }, rows: sheet };
  });

  // ── GET /payouts/sheet/:driverId/trips?start&end ───────────────────────────
  // The per-driver trip log behind a sheet row, for the admin's drill-down.
  app.get<{ Params: { driverId: string }; Querystring: { start?: string; end?: string } }>(
    '/sheet/:driverId/trips',
    async (req) => {
      const { from, to } = parseRange(req.query);

      const rows = await db
        .select({
          id: trips.id,
          date: trips.completedAt,
          category: trips.category,
          pickup: trips.pickupAddress,
          dropoff: trips.dropoffAddress,
          grossCents: driverEarnings.grossCents,
          commissionCents: driverEarnings.commissionCents,
          netCents: driverEarnings.netCents,
        })
        .from(driverEarnings)
        .innerJoin(trips, eq(trips.id, driverEarnings.tripId))
        .where(
          and(
            eq(driverEarnings.driverId, req.params.driverId),
            eq(trips.status, 'completed'),
            gte(trips.completedAt, from),
            lt(trips.completedAt, to),
            // Same unpaid filter as the sheet, so the log totals to the row.
            isNull(driverEarnings.payoutId),
          ),
        )
        .orderBy(asc(trips.completedAt));

      return {
        trips: rows.map((r) => ({
          id: r.id,
          date: r.date,
          category: r.category,
          pickup: r.pickup,
          dropoff: r.dropoff,
          fare: rm(r.grossCents),
          commission: rm(r.commissionCents),
          net: rm(r.netCents),
        })),
      };
    },
  );


  // ── POST /payouts/sheet/export?start&end ───────────────────────────────────
  // Executes the payout: for each driver in scope it creates a `payouts` row
  // and stamps every earning it covers with that payout's id. That stamp is
  // what retires "pending payout" on the driver's earnings screen and what
  // makes the money show as "to bank" until finance confirms the transfer.
  //
  // A write, not a read, hence POST: re-running the same range pays nothing
  // twice, because already-stamped earnings are no longer selectable. Returns
  // the full account numbers finance needs for the transfer file, so it is
  // restricted to the roles that may trigger a payout — the client-side
  // `trigger_payout` permission is a UI convenience, not a guard.
  //
  // Drivers with no bank account on file are skipped: their earnings stay
  // unpaid (and keep showing as pending) until they add one in the driver app.
  app.post<{ Querystring: { start?: string; end?: string }; Body?: { driverIds?: string[] } }>(
    '/sheet/export',
    { preHandler: requireRole(['admin_super', 'admin_finance']) },
    async (req) => {
      const { start, end, from, to } = parseRange(req.query);
      const only = req.body?.driverIds?.length ? new Set(req.body.driverIds) : null;

      const earnings = await db
        .select({
          earningId: driverEarnings.id,
          driverId: driverEarnings.driverId,
          netCents: driverEarnings.netCents,
          driverName: users.fullName,
          bankName: driverBankAccounts.bankName,
          accountHolderName: driverBankAccounts.accountHolderName,
          accountNumber: driverBankAccounts.accountNumber,
        })
        .from(driverEarnings)
        .innerJoin(trips, eq(trips.id, driverEarnings.tripId))
        .innerJoin(driverBankAccounts, eq(driverBankAccounts.driverId, driverEarnings.driverId))
        .leftJoin(users, eq(users.id, driverEarnings.driverId))
        .where(
          and(
            eq(trips.status, 'completed'),
            gte(trips.completedAt, from),
            lt(trips.completedAt, to),
            isNull(driverEarnings.payoutId),
          ),
        );

      const byDriver = new Map<string, typeof earnings>();
      for (const e of earnings) {
        if (only && !only.has(e.driverId)) continue;
        const bucket = byDriver.get(e.driverId);
        if (bucket) bucket.push(e);
        else byDriver.set(e.driverId, [e]);
      }

      // One transaction for the whole sheet: a half-written export would leave
      // some drivers marked paid with no transfer file to back it up.
      const paid = await db.transaction(async (tx) => {
        const out: Array<{
          driverId: string;
          driverName: string;
          bank: string;
          accountHolderName: string;
          accountNumber: string;
          tripCount: number;
          amount: number;
        }> = [];

        for (const [driverId, rows] of byDriver) {
          const amountCents = rows.reduce((t, r) => t + r.netCents, 0);
          const [payout] = await tx
            .insert(payouts)
            .values({ driverId, amountCents, method: 'standard', status: 'pending' })
            .returning({ id: payouts.id });
          if (!payout) throw new Error('insert payouts returned no row');

          await tx
            .update(driverEarnings)
            .set({ payoutId: payout.id })
            .where(inArray(driverEarnings.id, rows.map((r) => r.earningId)));

          const first = rows[0]!;
          out.push({
            driverId,
            driverName: first.driverName ?? driverId,
            bank: first.bankName,
            accountHolderName: first.accountHolderName,
            accountNumber: first.accountNumber,
            tripCount: rows.length,
            amount: amountCents / 100,
          });
        }
        return out;
      });

      return { period: { start, end }, rows: paid.sort((a, b) => b.amount - a.amount) };
    },
  );
}

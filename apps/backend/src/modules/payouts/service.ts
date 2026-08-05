// modules/payouts/service.ts
// Driver payouts via Stripe Connect (spec §12): Express onboarding, earnings
// dashboard reads, and instant cashout. Also handles the Connect/payout webhook
// events fanned in from the payments webhook handler. Money is integer sen.

import { env } from '../../config/env';
import { DomainError } from '../../shared/errors';
import { stripe, type StripeEvent } from '../../external/stripe';
import { fromCents } from '../../lib/money';
import * as repo from './repo';

function startOfTodayUtc(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

// Earnings are reported on the driver's calendar, not UTC — a trip at 01:00 MYT
// belongs to that morning, not to the previous UTC day. Asia/Kuala_Lumpur is a
// fixed +08:00 with no DST, so a constant offset is exact.
const MYT_OFFSET_MS = 8 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** UTC instant of midnight Malaysian time, `daysAgo` days back from `now`. */
function startOfDayMyt(now: Date, daysAgo = 0): Date {
  const shifted = new Date(now.getTime() + MYT_OFFSET_MS);
  const midnight = Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate());
  return new Date(midnight - MYT_OFFSET_MS - daysAgo * DAY_MS);
}

/** 'YYYY-MM-DD' of a UTC instant as seen in Malaysian time. */
function mytDateKey(at: Date): string {
  return new Date(at.getTime() + MYT_OFFSET_MS).toISOString().slice(0, 10);
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

export const payoutsService = {
  // ------------------------------------------------------------------
  // Connect onboarding (spec §12.1)
  // ------------------------------------------------------------------
  async startOnboarding(driverId: string): Promise<{ onboardingUrl: string }> {
    let acct = await repo.getConnectAccount(driverId);
    if (!acct) {
      const account = await stripe.accounts.create({
        type: 'express',
        country: 'MY',
        capabilities: { transfers: { requested: true } },
        business_type: 'individual',
        metadata: { driver_id: driverId },
      });
      acct = await repo.insertConnectAccount({
        driverId,
        stripeAccountId: account.id,
      });
    }
    const link = await stripe.accountLinks.create({
      account: acct.stripeAccountId,
      type: 'account_onboarding',
      refresh_url: `${env.APP_URL}/driver/connect/refresh`,
      return_url: `${env.APP_URL}/driver/connect/done`,
    });
    return { onboardingUrl: link.url };
  },

  async getConnectStatus(driverId: string): Promise<{
    status: 'not_started' | repo.ConnectAccountRow['status'];
    payoutsEnabled: boolean;
  }> {
    const acct = await repo.getConnectAccount(driverId);
    if (!acct) return { status: 'not_started', payoutsEnabled: false };
    return { status: acct.status, payoutsEnabled: acct.payoutsEnabled };
  },

  /** A driver may only go online once their Connect account can take payouts. */
  async canDriverGoOnline(driverId: string): Promise<boolean> {
    const acct = await repo.getConnectAccount(driverId);
    return !!acct && acct.status === 'active' && acct.payoutsEnabled;
  },

  // ------------------------------------------------------------------
  // Earnings dashboard (spec §12.2)
  // ------------------------------------------------------------------
  async getEarnings(driverId: string) {
    const now = new Date();
    const todayStart = startOfDayMyt(now);
    // Rolling 7 days *inclusive of today* — 6 days back is the first bucket.
    const weekStart = startOfDayMyt(now, 6);

    const [lifetime, today, week, daily, recent, payoutHistory, connect, lastCashout] =
      await Promise.all([
        repo.earningsSummary(driverId),
        repo.earningsSummary(driverId, todayStart),
        repo.earningsSummary(driverId, weekStart),
        repo.dailyEarnings(driverId, weekStart),
        repo.recentEarnings(driverId),
        repo.listPayouts(driverId),
        this.getConnectStatus(driverId),
        repo.lastInstantCashoutAt(driverId),
      ]);

    // Pad the sparse day buckets so the chart always renders 7 columns.
    const byDay = new Map(daily.map((d) => [d.day, d]));
    const dailyBreakdown = Array.from({ length: 7 }, (_, i) => {
      const at = startOfDayMyt(now, 6 - i);
      const key = mytDateKey(at);
      const bucket = byDay.get(key);
      return {
        date: key,
        day: WEEKDAYS[new Date(at.getTime() + MYT_OFFSET_MS).getUTCDay()],
        amountRm: fromCents(bucket?.netCents ?? 0),
        trips: bucket?.tripCount ?? 0,
        isToday: key === mytDateKey(todayStart),
      };
    });

    const cooldownHoursLeft = lastCashout
      ? Math.max(0, env.CASHOUT_COOLDOWN_HOURS - (now.getTime() - lastCashout.getTime()) / 36e5)
      : 0;

    return {
      lifetime,
      today,
      week,
      dailyBreakdown,
      recent: recent.map((e) => ({
        tripId: e.tripId,
        grossRm: fromCents(e.grossCents),
        netRm: fromCents(e.netCents),
        transferred: e.transferred,
        at: e.createdAt,
        pickupAddress: e.pickupAddress,
        dropoffAddress: e.dropoffAddress,
        riderName: e.riderName,
        ratingGiven: e.riderRating,
        distanceKm: e.distanceMeters == null ? null : e.distanceMeters / 1000,
        completedAt: e.completedAt,
      })),
      payouts: payoutHistory.map((p) => ({
        id: p.id,
        amountRm: fromCents(p.amountCents),
        method: p.method,
        status: p.status,
        at: p.createdAt,
      })),
      // Drives the cashout button. The real balance check happens server-side in
      // requestCashout — this is only enough to avoid offering a doomed tap.
      cashout: {
        eligible: connect.payoutsEnabled && cooldownHoursLeft === 0,
        connectStatus: connect.status,
        payoutsEnabled: connect.payoutsEnabled,
        cooldownHoursLeft: Math.ceil(cooldownHoursLeft),
        minCashoutRm: fromCents(env.MIN_CASHOUT_CENTS),
      },
    };
  },

  // ------------------------------------------------------------------
  // Instant cashout (spec §12.3)
  // ------------------------------------------------------------------
  async requestCashout(driverId: string): Promise<{ amountRm: number; status: string }> {
    const acct = await repo.getConnectAccount(driverId);
    if (!acct || acct.status !== 'active' || !acct.payoutsEnabled) {
      throw new DomainError('CONNECT_NOT_ACTIVE', 'Payouts are not enabled yet.', 422);
    }

    const last = await repo.lastInstantCashoutAt(driverId);
    if (last) {
      const hours = (Date.now() - last.getTime()) / 36e5;
      if (hours < env.CASHOUT_COOLDOWN_HOURS) {
        throw new DomainError('CASHOUT_COOLDOWN', 'Only one cashout per 24 hours.', 429);
      }
    }

    const balance = await stripe.balance.retrieve({ stripeAccount: acct.stripeAccountId });
    const availableCents =
      balance.available.find((b) => b.currency === env.CURRENCY)?.amount ?? 0;
    if (availableCents < env.MIN_CASHOUT_CENTS) {
      throw new DomainError('BELOW_MIN_CASHOUT', 'Balance is below the cashout minimum.', 422);
    }

    // todayKey idempotency prevents a double-tap firing two payouts (spec §12.3).
    const payout = await stripe.payouts.create(
      { amount: availableCents, currency: env.CURRENCY, method: 'instant' },
      {
        stripeAccount: acct.stripeAccountId,
        idempotencyKey: `cashout_${driverId}_${startOfTodayUtc(new Date()).toISOString().slice(0, 10)}`,
      },
    );
    await repo.insertPayout({
      driverId,
      stripePayoutId: payout.id,
      amountCents: availableCents,
      method: 'instant',
    });
    return { amountRm: fromCents(availableCents), status: 'pending' };
  },

  // ------------------------------------------------------------------
  // Webhook events fanned in from the payments handler (spec §14)
  // ------------------------------------------------------------------
  async handleStripeEvent(event: StripeEvent): Promise<void> {
    const obj = event.data.object as Record<string, unknown>;
    switch (event.type) {
      case 'account.updated': {
        const acct = obj as { id: string; payouts_enabled?: boolean };
        await repo.updateConnectByStripeId(acct.id, {
          payoutsEnabled: !!acct.payouts_enabled,
          status: acct.payouts_enabled ? 'active' : 'restricted',
        });
        break;
      }
      case 'payout.paid': {
        const po = obj as { id: string };
        await repo.updatePayoutStatusByStripeId(po.id, 'paid');
        break;
      }
      case 'payout.failed': {
        const po = obj as { id: string };
        await repo.updatePayoutStatusByStripeId(po.id, 'failed');
        break;
      }
      default:
        break; // ignore unhandled events
    }
  },
};

// modules/payouts/service.ts
// Driver payouts via Stripe Connect (spec §12): Express onboarding, earnings
// dashboard reads, and instant cashout. Also handles the Connect/payout webhook
// events fanned in from the payments webhook handler. Money is integer sen.

import { env } from '../../config/env';
import { logger } from '../../config/logger';
import { DomainError } from '../../shared/errors';
import {
  isInstantPayoutsUnsupported,
  stripe,
  type StripeAccount,
  type StripeEvent,
} from '../../external/stripe';
import { fromCents } from '../../lib/money';
import * as repo from './repo';

/**
 * Settled vs still-clearing balance on a driver's Connect account, in sen.
 *
 * `driver_earnings` records what a driver has *earned*; this is what Stripe
 * will actually let them take out today. The two differ for days — card money
 * sits in Stripe's settlement hold — and drivers read the gap as missing pay,
 * so the earnings screen shows both. Returns null if Stripe can't be reached:
 * the dashboard must still render.
 */
async function readBalance(
  stripeAccountId: string,
): Promise<{ availableCents: number; pendingCents: number } | null> {
  try {
    const b = await stripe.balance.retrieve({ stripeAccount: stripeAccountId });
    const sum = (rows: Array<{ currency: string; amount: number }>) =>
      rows.filter((r) => r.currency === env.CURRENCY).reduce((t, r) => t + r.amount, 0);
    return { availableCents: sum(b.available), pendingCents: sum(b.pending) };
  } catch (err) {
    logger.warn({ err, stripeAccountId }, 'balance read failed — hiding cashable amount');
    return null;
  }
}

/** Stripe's capability status → our narrower `connect_accounts.status` enum. */
function toRowStatus(
  capabilityStatus: StripeAccount['capabilityStatus'],
): repo.ConnectAccountRow['status'] {
  return capabilityStatus === 'active'
    ? 'active'
    : capabilityStatus === 'restricted'
      ? 'restricted'
      : 'onboarding';
}

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
      const driver = await repo.getDriverContact(driverId);
      const account = await stripe.accounts.create({
        country: 'MY',
        entityType: 'individual',
        contactEmail: driver?.email ?? undefined,
        displayName: driver?.fullName ?? undefined,
        metadata: { driver_id: driverId },
      });
      acct = await repo.insertConnectAccount({
        driverId,
        stripeAccountId: account.id,
      });
    }
    const link = await stripe.accountLinks.create({
      account: acct.stripeAccountId,
      refreshUrl: `${env.APP_URL}/driver/connect/refresh`,
      returnUrl: `${env.APP_URL}/driver/connect/done`,
    });
    return { onboardingUrl: link.url };
  },

  /**
   * Status for the driver app's payouts screen. Until the account is live we
   * re-read it from Stripe rather than trusting our row: the app polls this on
   * every return from the hosted flow, so a driver activates the moment they
   * finish even if the capability webhook is slow, misconfigured, or (in mock
   * mode) never fires at all. Webhooks stay the fast path, not the only path.
   */
  async getConnectStatus(driverId: string): Promise<{
    status: 'not_started' | repo.ConnectAccountRow['status'];
    payoutsEnabled: boolean;
  }> {
    const acct = await repo.getConnectAccount(driverId);
    if (!acct) return { status: 'not_started', payoutsEnabled: false };
    if (acct.status === 'active' && acct.payoutsEnabled) {
      return { status: acct.status, payoutsEnabled: acct.payoutsEnabled };
    }

    try {
      const live = await stripe.accounts.retrieve(acct.stripeAccountId);
      const status = toRowStatus(live.capabilityStatus);
      if (status !== acct.status || live.payoutsEnabled !== acct.payoutsEnabled) {
        await repo.updateConnectByStripeId(acct.stripeAccountId, {
          status,
          payoutsEnabled: live.payoutsEnabled,
        });
      }
      return { status, payoutsEnabled: live.payoutsEnabled };
    } catch (err) {
      // A provider hiccup must not blank the screen — fall back to our row.
      logger.warn({ err, driverId }, 'connect status refresh failed — serving cached row');
      return { status: acct.status, payoutsEnabled: acct.payoutsEnabled };
    }
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

    // Only worth a round trip to Stripe once the account can actually pay out.
    const acct = connect.payoutsEnabled ? await repo.getConnectAccount(driverId) : undefined;
    const balance = acct ? await readBalance(acct.stripeAccountId) : null;

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
        arrivalDate: p.arrivalDate,
      })),
      // Drives the cashout button. `requestCashout` re-checks everything
      // server-side — this is only enough to avoid offering a doomed tap.
      cashout: {
        eligible:
          connect.payoutsEnabled &&
          cooldownHoursLeft === 0 &&
          (balance == null || balance.availableCents >= env.MIN_CASHOUT_CENTS),
        connectStatus: connect.status,
        payoutsEnabled: connect.payoutsEnabled,
        cooldownHoursLeft: Math.ceil(cooldownHoursLeft),
        minCashoutRm: fromCents(env.MIN_CASHOUT_CENTS),
        // null when Stripe couldn't be read — the app hides the row rather
        // than showing a zero it can't stand behind.
        availableRm: balance ? fromCents(balance.availableCents) : null,
        clearingRm: balance ? fromCents(balance.pendingCents) : null,
        // Money that has left the Stripe balance but hasn't hit the bank yet.
        // Without this a driver sees their balance drop to zero with nothing
        // to show for it. `payout.paid` webhooks retire these rows.
        inTransitRm: fromCents(
          payoutHistory
            .filter((p) => p.status === 'pending')
            .reduce((t, p) => t + p.amountCents, 0),
        ),
        // Soonest expected arrival among those in-transit payouts.
        inTransitArrival:
          payoutHistory
            .filter((p) => p.status === 'pending' && p.arrivalDate)
            .map((p) => p.arrivalDate as Date)
            .sort((a, b) => a.getTime() - b.getTime())[0] ?? null,
      },
    };
  },

  // ------------------------------------------------------------------
  // Instant cashout (spec §12.3)
  // ------------------------------------------------------------------
  async requestCashout(
    driverId: string,
  ): Promise<{ amountRm: number; status: string; method: 'instant' | 'standard' }> {
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
    const todayKey = `cashout_${driverId}_${startOfTodayUtc(new Date())
      .toISOString()
      .slice(0, 10)}`;

    // Instant Payouts are not available in Malaysia (and need a debit card as
    // the external account). Try instant so the code stays correct wherever
    // Stripe does support it, and fall back to a standard bank payout — same
    // money, arrives in a day or two instead of minutes. The fallback needs its
    // own idempotency key: the instant attempt has already bound `todayKey`,
    // and reusing it with different params is an idempotency conflict.
    let payout: Awaited<ReturnType<typeof stripe.payouts.create>>;
    let method: 'instant' | 'standard' = 'instant';
    try {
      payout = await stripe.payouts.create(
        { amount: availableCents, currency: env.CURRENCY, method: 'instant' },
        { stripeAccount: acct.stripeAccountId, idempotencyKey: todayKey },
      );
    } catch (err) {
      if (!isInstantPayoutsUnsupported(err)) throw err;
      method = 'standard';
      payout = await stripe.payouts.create(
        { amount: availableCents, currency: env.CURRENCY, method: 'standard' },
        { stripeAccount: acct.stripeAccountId, idempotencyKey: `${todayKey}_standard` },
      );
    }

    await repo.insertPayout({
      driverId,
      stripePayoutId: payout.id,
      amountCents: availableCents,
      method,
      arrivalDate: new Date(payout.arrival_date * 1000),
    });
    return { amountRm: fromCents(availableCents), status: 'pending', method };
  },

  // ------------------------------------------------------------------
  // Webhook events fanned in from the payments handler (spec §14)
  // ------------------------------------------------------------------
  async handleStripeEvent(event: StripeEvent): Promise<void> {
    const obj = event.data.object as Record<string, unknown>;
    switch (event.type) {
      // v1 `account.updated` still fires for v2 accounts (they remain readable
      // through the v1 API), and its payload carries the flags inline.
      case 'account.updated': {
        const acct = obj as { id: string; payouts_enabled?: boolean };
        await repo.updateConnectByStripeId(acct.id, {
          payoutsEnabled: !!acct.payouts_enabled,
          status: acct.payouts_enabled ? 'active' : 'restricted',
        });
        break;
      }
      // Accounts v2 emits *thin* events: the payload names the account but
      // carries no state, so we re-read the account to get the capabilities.
      case 'v2.core.account[configuration.recipient].capability_status_updated':
      case 'v2.core.account.updated': {
        const accountId =
          (obj as { id?: string }).id ??
          (event as unknown as { related_object?: { id?: string } }).related_object?.id;
        if (!accountId) break;
        const live = await stripe.accounts.retrieve(accountId);
        await repo.updateConnectByStripeId(accountId, {
          payoutsEnabled: live.payoutsEnabled,
          status: toRowStatus(live.capabilityStatus),
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

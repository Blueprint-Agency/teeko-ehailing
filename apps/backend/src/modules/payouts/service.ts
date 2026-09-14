// modules/payouts/service.ts
// Driver payouts (spec §12): earnings dashboard reads, plus the Stripe Connect
// onboarding/webhook plumbing kept for the scheduled payout rail. Driver-facing
// earnings never touch Stripe — Teeko transfers to the bank account the driver
// registers in the app. Money is integer sen.

import { env } from '../../config/env';
import { logger } from '../../config/logger';
import {
  stripe,
  type StripeAccount,
  type StripeEvent,
} from '../../external/stripe';
import { fromCents } from '../../lib/money';
import * as repo from './repo';

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

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
] as const;

export type EarningsPeriod = 'day' | 'week' | 'month';

/**
 * Days each period covers, counting today as day one. "Month" is 28 days, not
 * 30: four whole weeks bucket evenly into four chart columns and compare
 * like-for-like against the four before them, which a 30-day window cannot do.
 */
const PERIOD_DAYS: Record<EarningsPeriod, number> = { day: 1, week: 7, month: 28 };

/**
 * Cap on the trip list. A busy month can run to hundreds of trips and this is a
 * dashboard, not a full history — the response flags when it has been cut so
 * the app can say so rather than quietly showing a partial list.
 */
const RECENT_LIMIT = 100;

export type EarningsColumn = {
  key: string;
  label: string;
  amountRm: number;
  trips: number;
  /** The column the driver is currently inside — highlighted in the chart. */
  isCurrent: boolean;
};

/**
 * Chart columns for the selected period, padded so every column renders even
 * where there were no trips: 4-hour blocks across today, one per day across a
 * week, one per week across a month. Columns run oldest → newest.
 */
function buildBreakdown(
  period: EarningsPeriod,
  now: Date,
  todayStart: Date,
  buckets: Array<{ key: string; netCents: number; tripCount: number }>,
): EarningsColumn[] {
  const byKey = new Map(buckets.map((b) => [b.key, b]));

  if (period === 'day') {
    const dayKey = mytDateKey(todayStart);
    const nowHour = new Date(now.getTime() + MYT_OFFSET_MS).getUTCHours();
    return Array.from({ length: 6 }, (_, i) => {
      const startHour = i * 4;
      let netCents = 0;
      let trips = 0;
      for (let h = startHour; h < startHour + 4; h += 1) {
        const b = byKey.get(`${dayKey}T${String(h).padStart(2, '0')}`);
        if (b) {
          netCents += b.netCents;
          trips += b.tripCount;
        }
      }
      return {
        key: `${dayKey}T${String(startHour).padStart(2, '0')}`,
        label: `${String(startHour).padStart(2, '0')}:00`,
        amountRm: fromCents(netCents),
        trips,
        isCurrent: nowHour >= startHour && nowHour < startHour + 4,
      };
    });
  }

  const span = period === 'week' ? 1 : 7; // days folded into one column
  const columns = period === 'week' ? 7 : 4;
  const todayKey = mytDateKey(todayStart);

  return Array.from({ length: columns }, (_, i) => {
    // The newest column ends today; each earlier one steps back a whole span.
    const startDaysAgo = (columns - 1 - i) * span + (span - 1);
    const start = startOfDayMyt(now, startDaysAgo);
    let netCents = 0;
    let trips = 0;
    let isCurrent = false;
    for (let d = 0; d < span; d += 1) {
      const key = mytDateKey(startOfDayMyt(now, startDaysAgo - d));
      const b = byKey.get(key);
      if (b) {
        netCents += b.netCents;
        trips += b.tripCount;
      }
      if (key === todayKey) isCurrent = true;
    }
    const shifted = new Date(start.getTime() + MYT_OFFSET_MS);
    return {
      key: mytDateKey(start),
      // getUTCDay/getUTCMonth are always in range, so the lookups can't miss.
      label:
        period === 'week'
          ? WEEKDAYS[shifted.getUTCDay()]!
          : `${shifted.getUTCDate()} ${MONTHS[shifted.getUTCMonth()]!}`,
      amountRm: fromCents(netCents),
      trips,
      isCurrent,
    };
  });
}

/**
 * Percentage change against the previous window. Null when there is no
 * baseline: a first week with nothing before it has no "+100%", it has no
 * trend at all, and rendering one would invent a comparison.
 */
function pctChange(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return ((current - previous) / previous) * 100;
}

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
  async getEarnings(driverId: string, period: EarningsPeriod = 'week') {
    const now = new Date();
    const todayStart = startOfDayMyt(now);
    const days = PERIOD_DAYS[period];

    // Rolling windows *inclusive of today* — `days - 1` back is the first
    // bucket. The previous window is the same length immediately before it, so
    // the two are like-for-like even mid-day (both are truncated identically).
    const periodStart = startOfDayMyt(now, days - 1);
    const previousStart = startOfDayMyt(now, days * 2 - 1);

    const [lifetime, current, previous, buckets, recent, payoutHistory, bankAccount, pendingNetCents] =
      await Promise.all([
        repo.earningsSummary(driverId),
        repo.earningsSummary(driverId, periodStart),
        repo.earningsSummary(driverId, previousStart, periodStart),
        repo.bucketedEarnings(driverId, periodStart, period === 'day' ? 'hour' : 'day'),
        // The trip list shows the same window as everything else on the screen.
        repo.recentEarnings(driverId, periodStart, RECENT_LIMIT),
        repo.listPayouts(driverId),
        repo.getBankAccount(driverId),
        repo.unpaidNetCents(driverId),
      ]);

    const breakdown = buildBreakdown(period, now, todayStart, buckets);

    const avg = (s: repo.EarningsSummary) =>
      s.tripCount > 0 ? s.netCents / s.tripCount : 0;

    return {
      period,
      lifetime,
      /** Totals for the selected window, and for the one immediately before. */
      current,
      previous,
      /** Percent change vs the previous window; null when there is no baseline. */
      trend: {
        netPct: pctChange(current.netCents, previous.netCents),
        tripsPct: pctChange(current.tripCount, previous.tripCount),
        avgPct: pctChange(avg(current), avg(previous)),
      },
      breakdown,
      /** True when the list hit RECENT_LIMIT and older trips were dropped. */
      recentTruncated: recent.length >= RECENT_LIMIT,
      recent: recent.map((e) => ({
        tripId: e.tripId,
        grossRm: fromCents(e.grossCents),
        netRm: fromCents(e.netCents),
        transferred: e.transferred,
        paidOut: e.paidOut,
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
      // Where the money goes. Teeko transfers earnings to the driver's own
      // bank account on the payout cycle — there is no in-app cashout, so the
      // app only needs to know whether an account is on file and what is owed.
      payout: {
        bankAccountSet: !!bankAccount,
        bankName: bankAccount?.bankName ?? null,
        // Earned, not yet covered by a payout — the next transfer's amount.
        pendingRm: fromCents(pendingNetCents),
        // Sent but not yet credited by the bank. Without this a driver sees
        // the pending figure drop with nothing to show for it.
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

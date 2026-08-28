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

    const [lifetime, today, week, daily, recent, payoutHistory, bankAccount, pendingNetCents] =
      await Promise.all([
        repo.earningsSummary(driverId),
        repo.earningsSummary(driverId, todayStart),
        repo.earningsSummary(driverId, weekStart),
        repo.dailyEarnings(driverId, weekStart),
        repo.recentEarnings(driverId),
        repo.listPayouts(driverId),
        repo.getBankAccount(driverId),
        repo.unpaidNetCents(driverId),
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

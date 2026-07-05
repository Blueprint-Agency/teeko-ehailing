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
    const [lifetime, today, recent, payoutHistory] = await Promise.all([
      repo.earningsSummary(driverId),
      repo.earningsSummary(driverId, startOfTodayUtc(now)),
      repo.recentEarnings(driverId),
      repo.listPayouts(driverId),
    ]);
    return {
      lifetime,
      today,
      recent: recent.map((e) => ({
        tripId: e.tripId,
        grossRm: fromCents(e.grossCents),
        netRm: fromCents(e.netCents),
        transferred: e.transferred,
        at: e.createdAt,
      })),
      payouts: payoutHistory.map((p) => ({
        id: p.id,
        amountRm: fromCents(p.amountCents),
        method: p.method,
        status: p.status,
        at: p.createdAt,
      })),
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

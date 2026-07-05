// modules/payments/service.ts
// Rider charging, refunds, and the Stripe webhook handler — the single source
// of truth for the payments domain (spec §7–§14). Routes call in here; the repo
// stays private. All money is integer sen; Stripe/TNG live behind adapters so
// the flow runs against mocks in v0.1 (see external/stripe.ts, external/tng.ts).

import { env } from '../../config/env';
import { logger } from '../../config/logger';
import { DomainError } from '../../shared/errors';
import {
  isStripeCardError,
  stripe,
  type StripeEvent,
  type StripePaymentIntent,
} from '../../external/stripe';
import { tng } from '../../external/tng';
import { computeCommission } from './commission';
import * as repo from './repo';

// ---- Wire shapes (mirror the app-facing payment method; defined locally) ----

export type PaymentMethodType = repo.PaymentMethodType;

export type PaymentMethodView = {
  id: string;
  type: PaymentMethodType;
  label: string | null;
  isDefault: boolean;
};

/** Just the trip fields the charge path needs (avoids a trips import cycle). */
export type ChargeableTrip = {
  id: string;
  riderId: string;
  driverId: string | null;
  paymentMethodId: string | null;
  category?: string | null;
};

function toView(row: repo.PaymentMethodRow): PaymentMethodView {
  return { id: row.id, type: row.type, label: row.label, isDefault: row.isDefault };
}

async function getOrCreateStripeCustomer(riderId: string): Promise<string> {
  const seed = await repo.getStripeCustomerSeed(riderId);
  if (seed.stripeCustomerId) return seed.stripeCustomerId;
  const customer = await stripe.customers.create({
    name: seed.fullName ?? undefined,
    email: seed.email ?? undefined,
    metadata: { rider_id: riderId },
  });
  await repo.setStripeCustomerId(riderId, customer.id);
  return customer.id;
}

export const paymentsService = {
  // ------------------------------------------------------------------
  // Payment methods (spec §7)
  // ------------------------------------------------------------------
  async listMethods(riderId: string): Promise<PaymentMethodView[]> {
    const rows = await repo.listMethods(riderId);
    return rows.map(toView);
  },

  async addMethod(
    riderId: string,
    type: PaymentMethodType,
    token: string | null,
  ): Promise<PaymentMethodView> {
    let externalId: string | null = null;
    let label: string | null = null;

    if (type === 'card' || type === 'google_pay') {
      if (!token) throw new DomainError('TOKEN_REQUIRED', 'A card token is required.', 400);
      const customerId = await getOrCreateStripeCustomer(riderId);
      const pm = await stripe.paymentMethods.attach(token, { customer: customerId });
      externalId = pm.id;
      label = pm.card
        ? `${pm.card.brand.toUpperCase()} •••• ${pm.card.last4}`
        : type === 'google_pay'
          ? 'Google Pay'
          : 'Card';
    } else if (type === 'tng') {
      if (!token)
        throw new DomainError('TOKEN_REQUIRED', 'A TNG agreement token is required.', 400);
      externalId = token; // reusable TNG payment agreement id
      label = "Touch 'n Go eWallet";
    } else {
      // cash — no external token, driver collects on completion.
      label = 'Cash';
    }

    const isFirst = (await repo.countMethods(riderId)) === 0;
    const row = await repo.insertMethod({
      userId: riderId,
      type,
      externalId,
      label,
      isDefault: isFirst,
    });
    return toView(row);
  },

  async setDefault(riderId: string, methodId: string): Promise<PaymentMethodView[]> {
    const found = await repo.getMethodForUser(riderId, methodId);
    if (!found) throw new DomainError('METHOD_NOT_FOUND', 'Payment method not found.', 404);
    await repo.setDefaultMethod(riderId, methodId);
    return this.listMethods(riderId);
  },

  async deleteMethod(riderId: string, methodId: string): Promise<void> {
    const found = await repo.getMethodForUser(riderId, methodId);
    if (!found) throw new DomainError('METHOD_NOT_FOUND', 'Payment method not found.', 404);
    if (found.externalId && (found.type === 'card' || found.type === 'google_pay')) {
      await stripe.paymentMethods.detach(found.externalId).catch(() => null);
    }
    await repo.softDeleteMethod(methodId);
  },

  // ------------------------------------------------------------------
  // Booking gate (spec §11): block riders who owe money.
  // ------------------------------------------------------------------
  async assertNoOutstandingDebt(riderId: string): Promise<void> {
    const owed = await repo.getOpenDebtTotal(riderId);
    if (owed > 0) {
      throw new DomainError(
        'OUTSTANDING_BALANCE',
        'Settle your outstanding balance before booking a new ride.',
        422,
      );
    }
  },

  // ------------------------------------------------------------------
  // Charging at trip completion (spec §8)
  // ------------------------------------------------------------------

  /**
   * Charge the rider for a completed trip. Ledger row is written FIRST (pending)
   * so a crash mid-charge is recoverable by reconciliation (spec §15). Returns
   * the payment row. Never throws on an ordinary card decline — that becomes
   * rider debt while the driver is still paid (spec §11).
   */
  async chargeTripFare(trip: ChargeableTrip, amountCents: number): Promise<repo.PaymentRow> {
    return this.charge(trip, amountCents, 'trip_fare');
  },

  async chargeCancellationFee(
    trip: ChargeableTrip,
    amountCents: number,
  ): Promise<repo.PaymentRow> {
    return this.charge(trip, amountCents, 'cancellation_fee');
  },

  async charge(
    trip: ChargeableTrip,
    amountCents: number,
    kind: repo.PaymentKind,
  ): Promise<repo.PaymentRow> {
    // Resolve the method: explicit on the trip, else the rider's default.
    const method = trip.paymentMethodId
      ? await repo.getMethod(trip.paymentMethodId)
      : await repo.getDefaultMethod(trip.riderId);

    const { commissionCents, netCents } = computeCommission(amountCents, {
      category: trip.category,
    });

    const payment = await repo.insertPayment({
      tripId: trip.id,
      riderId: trip.riderId,
      driverId: trip.driverId,
      paymentMethodId: method?.id ?? null,
      kind,
      methodType: method?.type ?? 'cash',
      amountCents,
      commissionCents,
    });

    // No method on file → record as debt, settle before next ride (spec §9/§11).
    if (!method) {
      await repo.updatePayment(payment.id, { status: 'failed', failureCode: 'no_payment_method' });
      await repo.openDebt({ riderId: trip.riderId, paymentId: payment.id, amountCents });
      return (await repo.getPayment(payment.id)) ?? payment;
    }

    // Cash — driver collects; nothing to pull online. Still mirror earnings.
    if (method.type === 'cash') {
      await repo.updatePayment(payment.id, { status: 'succeeded' });
      await this.creditDriver(trip, payment.id, amountCents, commissionCents, netCents, false);
      return (await repo.getPayment(payment.id)) ?? payment;
    }

    try {
      if (method.type === 'card' || method.type === 'google_pay') {
        const customer = await getOrCreateStripeCustomer(trip.riderId);
        const destination = trip.driverId
          ? await repo.getConnectAccountId(trip.driverId)
          : null;

        const intent = await stripe.paymentIntents.create(
          {
            amount: amountCents,
            currency: env.CURRENCY,
            customer,
            payment_method: method.externalId ?? undefined,
            off_session: true,
            confirm: true,
            // Only route a driver cut on trip fares with an active Connect acct.
            ...(kind === 'trip_fare' && destination
              ? {
                  application_fee_amount: commissionCents,
                  transfer_data: { destination },
                }
              : {}),
            metadata: { trip_id: trip.id, payment_id: payment.id, kind },
          },
          { idempotencyKey: `charge_${payment.id}` },
        );

        await this.applyIntent(trip, payment.id, intent, amountCents, commissionCents, netCents);
      } else {
        // TNG — charged to Teeko; driver net moved by a separate transfer (mock).
        const result = await tng.chargeAgreement(
          method.externalId ?? '',
          amountCents,
          `charge_${payment.id}`,
        );
        if (result.status === 'succeeded') {
          await repo.updatePayment(payment.id, {
            status: 'succeeded',
            stripePaymentIntentId: result.id,
          });
          await this.creditDriver(trip, payment.id, amountCents, commissionCents, netCents, true);
        } else {
          await this.failCharge(trip, payment.id, amountCents, 'tng_declined');
        }
      }
    } catch (err) {
      if (isStripeCardError(err)) {
        await this.failCharge(trip, payment.id, amountCents, err.decline_code);
        return (await repo.getPayment(payment.id)) ?? payment;
      }
      throw err;
    }

    return (await repo.getPayment(payment.id)) ?? payment;
  },

  /** Map a Stripe PaymentIntent result onto the ledger (spec §8). */
  async applyIntent(
    trip: ChargeableTrip,
    paymentId: string,
    intent: StripePaymentIntent,
    amountCents: number,
    commissionCents: number,
    netCents: number,
  ): Promise<void> {
    if (intent.status === 'succeeded') {
      await repo.updatePayment(paymentId, {
        status: 'succeeded',
        stripePaymentIntentId: intent.id,
        receiptUrl: intent.receipt_url,
      });
      // Destination charge → the driver's net is already in their balance.
      await this.creditDriver(trip, paymentId, amountCents, commissionCents, netCents, true);
    } else if (intent.status === 'requires_action') {
      // 3DS — rider must authenticate in-app on next foreground (spec §18).
      await repo.updatePayment(paymentId, {
        status: 'requires_action',
        stripePaymentIntentId: intent.id,
      });
    } else {
      await this.failCharge(trip, paymentId, amountCents, 'requires_payment_method');
    }
  },

  async creditDriver(
    trip: ChargeableTrip,
    paymentId: string,
    grossCents: number,
    commissionCents: number,
    netCents: number,
    transferred: boolean,
  ): Promise<void> {
    if (!trip.driverId) return;
    await repo.upsertEarning({
      driverId: trip.driverId,
      tripId: trip.id,
      paymentId,
      grossCents,
      commissionCents,
      netCents,
      transferred,
    });
  },

  /** Charge failed but the trip happened — pay the driver, open rider debt. */
  async failCharge(
    trip: ChargeableTrip,
    paymentId: string,
    amountCents: number,
    failureCode: string,
  ): Promise<void> {
    await repo.updatePayment(paymentId, { status: 'failed', failureCode });
    await repo.openDebt({ riderId: trip.riderId, paymentId, amountCents });
    // Driver is guaranteed their earnings; collection risk sits with Teeko.
    const { commissionCents, netCents } = computeCommission(amountCents, {
      category: trip.category,
    });
    await this.creditDriver(trip, paymentId, amountCents, commissionCents, netCents, false);
    logger.warn(
      { paymentId, riderId: trip.riderId, failureCode },
      'trip charge failed — rider debt opened, driver paid',
    );
  },

  // ------------------------------------------------------------------
  // Refunds (spec §10) — admin-triggered.
  // ------------------------------------------------------------------
  async issueRefund(
    paymentId: string,
    opts: {
      amountCents?: number;
      reason: repo.RefundRow['reason'];
      reverseTransfer: boolean;
      by: string;
    },
  ): Promise<{ refundId: string; status: repo.RefundRow['status'] }> {
    const payment = await repo.getPayment(paymentId);
    if (!payment) throw new DomainError('PAYMENT_NOT_FOUND', 'Payment not found.', 404);
    if (payment.status !== 'succeeded' && payment.status !== 'partially_refunded') {
      throw new DomainError('PAYMENT_NOT_REFUNDABLE', 'Payment cannot be refunded.', 409);
    }
    if (!payment.stripePaymentIntentId) {
      throw new DomainError('PAYMENT_NOT_REFUNDABLE', 'No Stripe charge to refund.', 409);
    }

    const stripeRefund = await stripe.refunds.create(
      {
        payment_intent: payment.stripePaymentIntentId,
        amount: opts.amountCents,
        reverse_transfer: opts.reverseTransfer,
        refund_application_fee: opts.reverseTransfer,
        metadata: { payment_id: paymentId, reason: opts.reason, admin_id: opts.by },
      },
      { idempotencyKey: `refund_${paymentId}_${opts.amountCents ?? 'full'}` },
    );

    const refund = await repo.insertRefund({
      paymentId,
      stripeRefundId: stripeRefund.id,
      amountCents: opts.amountCents ?? payment.amountCents,
      reason: opts.reason,
      reversedTransfer: opts.reverseTransfer,
      issuedBy: opts.by,
    });
    // Do NOT flip payment.status here — wait for charge.refunded (spec §10/§14).
    return { refundId: refund.id, status: refund.status };
  },

  // ------------------------------------------------------------------
  // Admin refund console reads (spec §18)
  // ------------------------------------------------------------------
  async adminGetTripPayments(tripId: string) {
    const rows = await repo.listPaymentsForTrip(tripId);
    return Promise.all(
      rows.map(async (p) => ({ ...p, refunds: await repo.listRefundsForPayment(p.id) })),
    );
  },

  async adminGetPayment(paymentId: string) {
    const payment = await repo.getPayment(paymentId);
    if (!payment) throw new DomainError('PAYMENT_NOT_FOUND', 'Payment not found.', 404);
    const refundRows = await repo.listRefundsForPayment(paymentId);
    return { ...payment, refunds: refundRows };
  },

  // ------------------------------------------------------------------
  // Webhook handler (spec §14). Idempotent via webhook_events + unique indexes.
  // ------------------------------------------------------------------
  async handleStripeEvent(event: StripeEvent): Promise<void> {
    const isNew = await repo.recordWebhookEvent(event.id, event.type);
    if (!isNew) {
      logger.info({ eventId: event.id, type: event.type }, 'duplicate webhook — skipped');
      return;
    }

    const obj = event.data.object as Record<string, unknown>;
    switch (event.type) {
      case 'payment_intent.succeeded': {
        const pi = obj as { id: string; receipt_url?: string | null };
        const payment = await repo.getPaymentByIntent(pi.id);
        if (payment && payment.status !== 'succeeded') {
          await repo.updatePayment(payment.id, {
            status: 'succeeded',
            receiptUrl: pi.receipt_url ?? null,
          });
          if (payment.driverId && payment.tripId) {
            const netCents = payment.amountCents - payment.commissionCents;
            await repo.upsertEarning({
              driverId: payment.driverId,
              tripId: payment.tripId,
              paymentId: payment.id,
              grossCents: payment.amountCents,
              commissionCents: payment.commissionCents,
              netCents,
              transferred: true,
            });
          }
        }
        break;
      }
      case 'payment_intent.payment_failed': {
        const pi = obj as { id: string; last_payment_error?: { decline_code?: string } };
        const payment = await repo.getPaymentByIntent(pi.id);
        if (payment && payment.status !== 'failed') {
          await repo.updatePayment(payment.id, {
            status: 'failed',
            failureCode: pi.last_payment_error?.decline_code ?? 'charge_failed',
          });
          await repo.openDebt({
            riderId: payment.riderId,
            paymentId: payment.id,
            amountCents: payment.amountCents,
          });
        }
        break;
      }
      case 'charge.refunded': {
        const ch = obj as {
          payment_intent?: string;
          amount_refunded?: number;
          amount?: number;
          refunds?: { data?: Array<{ id: string }> };
        };
        const payment = ch.payment_intent
          ? await repo.getPaymentByIntent(ch.payment_intent)
          : undefined;
        if (payment) {
          const fullyRefunded = (ch.amount_refunded ?? 0) >= (ch.amount ?? payment.amountCents);
          await repo.updatePayment(payment.id, {
            status: fullyRefunded ? 'refunded' : 'partially_refunded',
          });
          for (const r of ch.refunds?.data ?? []) {
            const existing = await repo.getRefundByStripeId(r.id);
            if (existing) await repo.markRefundStatus(existing.id, 'succeeded');
          }
        }
        break;
      }
      default:
        // account.updated / payout.* are handled by the payouts service.
        await import('../payouts/service').then((m) =>
          m.payoutsService.handleStripeEvent(event),
        );
    }
  },
};

// External provider client — Stripe.
//
// v0.1 (mockup) ships a **mock gateway** so the whole payment flow runs
// end-to-end locally with no real money and no keys. The mock implements the
// exact surface the billing services call (spec §7–§14): PaymentIntents,
// Refunds, Connect accounts, Payouts, Balance, Webhooks.
//
// v1.0: `pnpm add stripe` and replace `createStripeGateway()`'s mock branch
// with a thin wrapper over the real SDK — every method here maps 1:1 to a
// Stripe SDK call, so nothing in services/ changes. See createStripeGateway().

import { randomBytes } from 'node:crypto';
import Stripe from 'stripe';
import { env } from '../config/env';
import { logger } from '../config/logger';

const rid = (prefix: string) => `${prefix}_${randomBytes(12).toString('hex')}`;

// ---- Wire shapes (subset of the Stripe objects we actually read) ----------

export type StripeCustomer = { id: string };
export type StripePaymentMethod = {
  id: string;
  card?: { brand: string; last4: string };
};
export type StripePaymentIntent = {
  id: string;
  status: 'succeeded' | 'requires_action' | 'processing' | 'requires_payment_method';
  amount: number;
  currency: string;
  receipt_url: string | null;
  latest_charge: string | null;
};
export type StripeRefund = {
  id: string;
  status: 'pending' | 'succeeded' | 'failed';
  amount: number;
};
export type StripeAccount = {
  id: string;
  payouts_enabled: boolean;
  charges_enabled: boolean;
};
export type StripeAccountLink = { url: string; expires_at: number };
export type StripePayout = {
  id: string;
  status: 'pending' | 'paid' | 'failed';
  amount: number;
  method: 'standard' | 'instant';
};
export type StripeBalance = {
  available: Array<{ currency: string; amount: number }>;
};
export type StripeEvent = {
  id: string;
  type: string;
  data: { object: Record<string, unknown> };
};

/** A Stripe card error surfaced by off-session charges (spec §11). */
export class StripeCardError extends Error {
  readonly type = 'StripeCardError';
  readonly code: string;
  readonly decline_code: string;
  constructor(code: string, decline_code: string, message: string) {
    super(message);
    this.code = code;
    this.decline_code = decline_code;
  }
}

export function isStripeCardError(err: unknown): err is StripeCardError {
  return err instanceof StripeCardError;
}

type ReqOpts = { idempotencyKey?: string; stripeAccount?: string };

export interface StripeGateway {
  customers: {
    create(params: {
      name?: string;
      email?: string;
      metadata?: Record<string, string>;
    }): Promise<StripeCustomer>;
  };
  paymentMethods: {
    attach(
      token: string,
      params: { customer: string },
    ): Promise<StripePaymentMethod>;
    detach(id: string): Promise<StripePaymentMethod>;
  };
  paymentIntents: {
    create(
      params: {
        amount: number;
        currency: string;
        customer?: string;
        payment_method?: string;
        off_session?: boolean;
        confirm?: boolean;
        application_fee_amount?: number;
        transfer_data?: { destination: string };
        metadata?: Record<string, string>;
      },
      opts?: ReqOpts,
    ): Promise<StripePaymentIntent>;
  };
  refunds: {
    create(
      params: {
        payment_intent: string;
        amount?: number;
        reverse_transfer?: boolean;
        refund_application_fee?: boolean;
        metadata?: Record<string, string>;
      },
      opts?: ReqOpts,
    ): Promise<StripeRefund>;
  };
  accounts: {
    create(params: {
      type: 'express';
      country: string;
      capabilities?: unknown;
      business_type?: string;
      metadata?: Record<string, string>;
    }): Promise<StripeAccount>;
    retrieve(id: string): Promise<StripeAccount>;
  };
  accountLinks: {
    create(params: {
      account: string;
      type: 'account_onboarding';
      refresh_url: string;
      return_url: string;
    }): Promise<StripeAccountLink>;
  };
  payouts: {
    create(
      params: { amount: number; currency: string; method?: 'standard' | 'instant' },
      opts?: ReqOpts,
    ): Promise<StripePayout>;
  };
  balance: {
    retrieve(opts?: ReqOpts): Promise<StripeBalance>;
  };
  webhooks: {
    constructEvent(payload: string, signature: string, secret: string): StripeEvent;
  };
}

// ---------------------------------------------------------------------------
// Mock gateway — deterministic-enough for local dev. Trigger non-happy paths
// through the payment_method id so flows are testable without a real bank:
//   • pm id contains 'decline' → throws StripeCardError (insufficient funds)
//   • pm id contains '3ds'     → returns requires_action (3DS)
// Otherwise everything succeeds.
// ---------------------------------------------------------------------------
class MockStripeGateway implements StripeGateway {
  customers = {
    async create(): Promise<StripeCustomer> {
      return { id: rid('cus') };
    },
  };

  paymentMethods = {
    async attach(token: string): Promise<StripePaymentMethod> {
      const id = token.startsWith('pm_') ? token : rid('pm');
      return { id, card: { brand: 'visa', last4: '4242' } };
    },
    async detach(id: string): Promise<StripePaymentMethod> {
      return { id };
    },
  };

  paymentIntents = {
    async create(params: {
      amount: number;
      currency: string;
      payment_method?: string;
    }): Promise<StripePaymentIntent> {
      const pm = params.payment_method ?? '';
      if (pm.includes('decline')) {
        throw new StripeCardError(
          'card_declined',
          'insufficient_funds',
          'Your card has insufficient funds.',
        );
      }
      const id = rid('pi');
      if (pm.includes('3ds')) {
        return {
          id,
          status: 'requires_action',
          amount: params.amount,
          currency: params.currency,
          receipt_url: null,
          latest_charge: null,
        };
      }
      return {
        id,
        status: 'succeeded',
        amount: params.amount,
        currency: params.currency,
        receipt_url: `https://pay.stripe.com/receipts/${id}`,
        latest_charge: rid('ch'),
      };
    },
  };

  refunds = {
    async create(params: { amount?: number }): Promise<StripeRefund> {
      return { id: rid('re'), status: 'succeeded', amount: params.amount ?? 0 };
    },
  };

  accounts = {
    async create(): Promise<StripeAccount> {
      // A freshly-created account cannot yet take payouts — matches Stripe.
      return { id: rid('acct'), payouts_enabled: false, charges_enabled: false };
    },
    async retrieve(id: string): Promise<StripeAccount> {
      // Mock: pretend onboarding completed.
      return { id, payouts_enabled: true, charges_enabled: true };
    },
  };

  accountLinks = {
    async create(params: { account: string }): Promise<StripeAccountLink> {
      return {
        url: `https://connect.stripe.com/setup/mock/${params.account}`,
        expires_at: 0,
      };
    },
  };

  payouts = {
    async create(params: {
      amount: number;
      method?: 'standard' | 'instant';
    }): Promise<StripePayout> {
      return {
        id: rid('po'),
        status: 'pending',
        amount: params.amount,
        method: params.method ?? 'standard',
      };
    },
  };

  balance = {
    async retrieve(): Promise<StripeBalance> {
      // Mock available balance so cashout can be exercised locally.
      return { available: [{ currency: 'myr', amount: 5000 }] };
    },
  };

  webhooks = {
    // In mock mode we don't HMAC-verify; the caller passes the raw JSON body.
    constructEvent(payload: string): StripeEvent {
      return JSON.parse(payload) as StripeEvent;
    },
  };
}

// ---------------------------------------------------------------------------
// Real gateway — a thin 1:1 adapter over the Stripe SDK. Every method maps to
// exactly one SDK call, so nothing in services/ changes when this activates.
// Works against test keys (`sk_test_…`) too: charges land in the Stripe test
// dashboard with real `pi_…` ids. See createStripeGateway().
// ---------------------------------------------------------------------------

/** Build Stripe RequestOptions from our ReqOpts (idempotency + Connect acct). */
function reqOpts(opts?: ReqOpts): Stripe.RequestOptions {
  const o: Stripe.RequestOptions = {};
  if (opts?.idempotencyKey) o.idempotencyKey = opts.idempotencyKey;
  if (opts?.stripeAccount) o.stripeAccount = opts.stripeAccount;
  return o;
}

/** Map an SDK PaymentIntent onto our wire shape. `receipt_url` lives on the
 * expanded latest charge, not the intent, so we read it from there. */
function toIntent(pi: Stripe.PaymentIntent): StripePaymentIntent {
  const lc = pi.latest_charge;
  const charge = lc && typeof lc === 'object' ? lc : null;
  const status: StripePaymentIntent['status'] =
    pi.status === 'succeeded'
      ? 'succeeded'
      : pi.status === 'requires_action'
        ? 'requires_action'
        : pi.status === 'processing'
          ? 'processing'
          : 'requires_payment_method';
  return {
    id: pi.id,
    status,
    amount: pi.amount,
    currency: pi.currency,
    receipt_url: charge?.receipt_url ?? null,
    latest_charge: charge ? charge.id : typeof lc === 'string' ? lc : null,
  };
}

function adaptRealStripe(client: Stripe): StripeGateway {
  return {
    customers: {
      async create(params) {
        const c = await client.customers.create({
          name: params.name,
          email: params.email,
          metadata: params.metadata,
        });
        return { id: c.id };
      },
    },
    paymentMethods: {
      async attach(token, params) {
        const pm = await client.paymentMethods.attach(token, { customer: params.customer });
        return {
          id: pm.id,
          card: pm.card ? { brand: pm.card.brand, last4: pm.card.last4 } : undefined,
        };
      },
      async detach(id) {
        const pm = await client.paymentMethods.detach(id);
        return { id: pm.id };
      },
    },
    paymentIntents: {
      async create(params, opts) {
        try {
          const pi = await client.paymentIntents.create(
            { ...(params as Stripe.PaymentIntentCreateParams), expand: ['latest_charge'] },
            reqOpts(opts),
          );
          return toIntent(pi);
        } catch (err) {
          if (err instanceof Stripe.errors.StripeCardError) {
            // 3DS on an off_session charge surfaces as an error carrying the
            // still-open intent — surface it as requires_action, not a decline.
            const pi = (err as { payment_intent?: Stripe.PaymentIntent }).payment_intent;
            if (err.code === 'authentication_required' && pi) return toIntent(pi);
            throw new StripeCardError(
              err.code ?? 'card_declined',
              err.decline_code ?? 'generic_decline',
              err.message,
            );
          }
          throw err;
        }
      },
    },
    refunds: {
      async create(params, opts) {
        const r = await client.refunds.create(
          params as Stripe.RefundCreateParams,
          reqOpts(opts),
        );
        const status: StripeRefund['status'] =
          r.status === 'succeeded' ? 'succeeded' : r.status === 'pending' ? 'pending' : 'failed';
        return { id: r.id, status, amount: r.amount };
      },
    },
    accounts: {
      async create(params) {
        const a = await client.accounts.create(params as Stripe.AccountCreateParams);
        return {
          id: a.id,
          payouts_enabled: a.payouts_enabled ?? false,
          charges_enabled: a.charges_enabled ?? false,
        };
      },
      async retrieve(id) {
        const a = await client.accounts.retrieve(id);
        return {
          id: a.id,
          payouts_enabled: a.payouts_enabled ?? false,
          charges_enabled: a.charges_enabled ?? false,
        };
      },
    },
    accountLinks: {
      async create(params) {
        const l = await client.accountLinks.create(params);
        return { url: l.url, expires_at: l.expires_at };
      },
    },
    payouts: {
      async create(params, opts) {
        const p = await client.payouts.create(
          { amount: params.amount, currency: params.currency, method: params.method },
          reqOpts(opts),
        );
        const status: StripePayout['status'] =
          p.status === 'paid' ? 'paid' : p.status === 'failed' || p.status === 'canceled' ? 'failed' : 'pending';
        return { id: p.id, status, amount: p.amount, method: p.method as StripePayout['method'] };
      },
    },
    balance: {
      async retrieve(opts) {
        const b = await client.balance.retrieve({}, reqOpts(opts));
        return {
          available: b.available.map((a) => ({ currency: a.currency, amount: a.amount })),
        };
      },
    },
    webhooks: {
      constructEvent(payload, signature, secret) {
        return client.webhooks.constructEvent(payload, signature, secret) as unknown as StripeEvent;
      },
    },
  };
}

/**
 * Factory. Returns the real Stripe SDK gateway when a secret key is configured;
 * otherwise the mock. Test keys (`sk_test_…`) work — charges then appear in the
 * Stripe test dashboard. Set STRIPE_SECRET_KEY to flip real Stripe on.
 */
function createStripeGateway(): { gateway: StripeGateway; isMock: boolean } {
  if (!env.STRIPE_SECRET_KEY) {
    return { gateway: new MockStripeGateway(), isMock: true };
  }
  if (!env.STRIPE_WEBHOOK_SECRET) {
    // Charging works without it, but webhook signature verification (refunds,
    // async success, Connect events) will reject every delivery. Warn loudly.
    logger.warn(
      'STRIPE_SECRET_KEY is set but STRIPE_WEBHOOK_SECRET is missing — Stripe webhooks will fail signature verification.',
    );
  }
  const client = new Stripe(env.STRIPE_SECRET_KEY);
  logger.info(
    { mode: env.STRIPE_SECRET_KEY.startsWith('sk_test_') ? 'test' : 'live' },
    'Stripe: using real gateway',
  );
  return { gateway: adaptRealStripe(client), isMock: false };
}

const { gateway, isMock } = createStripeGateway();

export const stripe: StripeGateway = gateway;
export const isMockStripe = isMock;

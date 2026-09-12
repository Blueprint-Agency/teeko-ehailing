// External provider client — Stripe.
//
// v0.1 (mockup) ships a **mock gateway** so the whole payment flow runs
// end-to-end locally with no real money and no keys. The mock implements the
// exact surface the billing services call (spec §7–§14): PaymentIntents,
// Refunds, Connect accounts, Payouts, Balance, Webhooks.
//
// Setting STRIPE_SECRET_KEY swaps in the real SDK adapter instead; every
// gateway method maps 1:1 to an SDK call, so nothing in services/ changes.
// See createStripeGateway().
//
// Connect accounts use the **Accounts v2** API (`/v2/core/accounts`) — v1 is
// refused for new platforms. See docs/v0.1/tech/teeko-stripe-accounts-v2-migration.md.

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
/**
 * A driver's Connect account, flattened from the **Accounts v2** `recipient`
 * configuration. Two capabilities matter to us and they can differ:
 *   • `stripe_balance.stripe_transfers` — can receive destination-charge money
 *   • `stripe_balance.payouts`          — can move that balance to their bank
 */
export type StripeAccount = {
  id: string;
  payoutsEnabled: boolean;
  transfersEnabled: boolean;
  /** Worst of the two capability statuses — drives `connect_accounts.status`. */
  capabilityStatus: 'pending' | 'active' | 'restricted';
};
export type StripeAccountLink = { url: string; expires_at: number };
export type StripePayout = {
  id: string;
  status: 'pending' | 'paid' | 'failed';
  amount: number;
  method: 'standard' | 'instant';
  /** Unix seconds — Stripe's estimate of when the bank credits the driver. */
  arrival_date: number;
};
export type StripeBalance = {
  /** Settled and payable now. */
  available: Array<{ currency: string; amount: number }>;
  /** Charged but still inside Stripe's settlement hold. */
  pending: Array<{ currency: string; amount: number }>;
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

/**
 * Instant Payouts are country- and instrument-gated — Malaysia is not among
 * the markets Stripe supports, and they also require a debit-card external
 * account. Callers fall back to a standard bank payout when this is true.
 */
export function isInstantPayoutsUnsupported(err: unknown): boolean {
  return (
    err instanceof Stripe.errors.StripeError && err.code === 'instant_payouts_unsupported'
  );
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
      country: string;
      entityType: 'individual' | 'company';
      contactEmail?: string;
      displayName?: string;
      metadata?: Record<string, string>;
    }): Promise<StripeAccount>;
    retrieve(id: string): Promise<StripeAccount>;
  };
  accountLinks: {
    create(params: {
      account: string;
      refreshUrl: string;
      returnUrl: string;
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
      return {
        id: rid('acct'),
        payoutsEnabled: false,
        transfersEnabled: false,
        capabilityStatus: 'pending',
      };
    },
    async retrieve(id: string): Promise<StripeAccount> {
      // Mock: pretend the hosted onboarding flow completed. This is what makes
      // the status re-poll in `getConnectStatus` activate a driver locally.
      return {
        id,
        payoutsEnabled: true,
        transfersEnabled: true,
        capabilityStatus: 'active',
      };
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
      const method = params.method ?? 'standard';
      return {
        id: rid('po'),
        status: 'pending',
        amount: params.amount,
        method,
        // Instant lands the same day; standard takes a working day or so.
        arrival_date: Math.floor(Date.now() / 1000) + (method === 'instant' ? 0 : 86400),
      };
    },
  };

  balance = {
    async retrieve(): Promise<StripeBalance> {
      // Mock balance so cashout can be exercised locally — some settled, some
      // still clearing, which is what a real driver's account looks like.
      return {
        available: [{ currency: 'myr', amount: 5000 }],
        pending: [{ currency: 'myr', amount: 2500 }],
      };
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

/**
 * Flatten an Accounts v2 object onto our `StripeAccount`. Capability statuses
 * are `active | pending | restricted | unsupported`; we fold `unsupported`
 * (e.g. a country that can't receive transfers) into `restricted` because both
 * mean the same thing to a driver: they can't be paid until something changes.
 */
function toStripeAccount(a: Stripe.V2.Core.Account): StripeAccount {
  const recipient = a.configuration?.recipient?.capabilities?.stripe_balance;
  const merchant = a.configuration?.merchant?.capabilities?.stripe_balance;
  // `payouts` is reported under both configurations and is never requested
  // directly — Stripe derives it. Take whichever config reports it.
  const payouts = recipient?.payouts?.status ?? merchant?.payouts?.status;
  const transfers = recipient?.stripe_transfers?.status;
  const worst = (s: string | undefined): 'pending' | 'active' | 'restricted' =>
    s === 'active' ? 'active' : s === 'pending' || s === undefined ? 'pending' : 'restricted';
  const ranked = [worst(payouts), worst(transfers)];
  return {
    id: a.id,
    payoutsEnabled: payouts === 'active',
    transfersEnabled: transfers === 'active',
    capabilityStatus: ranked.includes('restricted')
      ? 'restricted'
      : ranked.includes('pending')
        ? 'pending'
        : 'active',
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
        const a = await client.v2.core.accounts.create({
          contact_email: params.contactEmail,
          display_name: params.displayName,
          identity: {
            country: params.country.toLowerCase(),
            entity_type: params.entityType,
          },
          // Drivers need `recipient` to receive our destination-charge
          // transfers. `merchant` is not optional here despite drivers never
          // taking payments directly: a recipient-only account forces
          // `responsibilities: application/application`, and Stripe blocks
          // Malaysian platforms from creating loss-liable accounts at all.
          // merchant + Stripe-owned responsibilities is the legacy Standard
          // shape, and the only combination a MY platform may create.
          // See docs/v0.1/tech/teeko-stripe-accounts-v2-migration.md §2.
          configuration: {
            recipient: {
              capabilities: { stripe_balance: { stripe_transfers: { requested: true } } },
            },
            merchant: {
              capabilities: { card_payments: { requested: true } },
            },
          },
          defaults: {
            responsibilities: {
              fees_collector: 'stripe',
              losses_collector: 'stripe',
            },
          },
          // Standard accounts get the full dashboard; `express` pairs with
          // application-collected fees, which MY platforms can't use.
          dashboard: 'full',
          metadata: params.metadata,
          include: ['configuration.recipient', 'configuration.merchant'],
        });
        return toStripeAccount(a);
      },
      async retrieve(id) {
        // Capability statuses are omitted unless explicitly included — v2
        // returns null for unrequested properties rather than the real value.
        const a = await client.v2.core.accounts.retrieve(id, {
          include: ['configuration.recipient', 'configuration.merchant'],
        });
        return toStripeAccount(a);
      },
    },
    accountLinks: {
      async create(params) {
        const l = await client.v2.core.accountLinks.create({
          account: params.account,
          use_case: {
            type: 'account_onboarding',
            account_onboarding: {
              configurations: ['recipient', 'merchant'],
              refresh_url: params.refreshUrl,
              return_url: params.returnUrl,
            },
          },
        });
        // v2 returns an ISO-8601 timestamp; our shape is Unix seconds.
        return { url: l.url, expires_at: Math.floor(Date.parse(l.expires_at) / 1000) };
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
        return {
          id: p.id,
          status,
          amount: p.amount,
          method: p.method as StripePayout['method'],
          arrival_date: p.arrival_date,
        };
      },
    },
    balance: {
      async retrieve(opts) {
        const b = await client.balance.retrieve({}, reqOpts(opts));
        const pick = (rows: Array<{ currency: string; amount: number }>) =>
          rows.map((a) => ({ currency: a.currency, amount: a.amount }));
        return { available: pick(b.available), pending: pick(b.pending) };
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
function createStripeGateway(): {
  gateway: StripeGateway;
  isMock: boolean;
  isTest: boolean;
} {
  if (!env.STRIPE_SECRET_KEY) {
    // The mock never talks to Stripe, so treat it as test mode — error detail
    // is safe to surface to clients (see http/middleware/errorHandler.ts).
    return { gateway: new MockStripeGateway(), isMock: true, isTest: true };
  }
  if (!env.STRIPE_WEBHOOK_SECRET) {
    // Charging works without it, but webhook signature verification (refunds,
    // async success, Connect events) will reject every delivery. Warn loudly.
    logger.warn(
      'STRIPE_SECRET_KEY is set but STRIPE_WEBHOOK_SECRET is missing — Stripe webhooks will fail signature verification.',
    );
  }
  const isTest = env.STRIPE_SECRET_KEY.startsWith('sk_test_');
  const client = new Stripe(env.STRIPE_SECRET_KEY);
  logger.info({ mode: isTest ? 'test' : 'live' }, 'Stripe: using real gateway');
  return { gateway: adaptRealStripe(client), isMock: false, isTest };
}

const { gateway, isMock, isTest } = createStripeGateway();

export const stripe: StripeGateway = gateway;
export const isMockStripe = isMock;
/** True for the mock and for `sk_test_…` keys — gates how much provider error detail leaves the server. */
export const isStripeTestMode = isTest;

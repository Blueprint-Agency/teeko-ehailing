# Teeko — Payment System

> **Version:** 0.1
> **Date:** 2026-07-02
> **Status:** Draft
> **Scope:** End-to-end payment architecture for Teeko — rider charging, driver payouts, refunds, reconciliation, and the money data model.
> **Depends on:** `teeko-tech-stack.md`, `teeko-api-implementation.md`, `teeko-api-reference.md`
> **Applies to:** v1.0 — Production. (v0.1 mockup mocks all of this locally; no real money moves.)

---

## Contents

1. [Overview](#1-overview)
2. [Guiding Principles](#2-guiding-principles)
3. [Provider Stack](#3-provider-stack)
4. [Money & Currency Conventions](#4-money--currency-conventions)
5. [Architecture](#5-architecture)
6. [The Two Sides of a Trip](#6-the-two-sides-of-a-trip)
7. [Rider — Payment Methods](#7-rider--payment-methods)
8. [Rider — Charging at Trip Completion](#8-rider--charging-at-trip-completion)
9. [Cancellation Fees](#9-cancellation-fees)
10. [Refunds](#10-refunds)
11. [Failed Payments & Rider Debt](#11-failed-payments--rider-debt)
12. [Driver — Payouts via Stripe Connect](#12-driver--payouts-via-stripe-connect)
13. [Commission Model](#13-commission-model)
14. [Webhooks & Idempotency](#14-webhooks--idempotency)
15. [Reconciliation](#15-reconciliation)
16. [Database Schema](#16-database-schema)
17. [Tax — SST & LHDN e-Invoicing](#17-tax--sst--lhdn-e-invoicing)
18. [Frontend Integration](#18-frontend-integration)
19. [Security, PCI & PDPA](#19-security-pci--pdpa)
20. [Environment Variables](#20-environment-variables)
21. [Deferred — Teeko Wallet](#21-deferred--teeko-wallet)

---

## 1. Overview

Teeko is a **two-sided marketplace**: a rider pays for a trip, Teeko keeps a commission, and the driver receives the remainder. This is the core structural difference from a single-sided checkout system (buy a package → get an entitlement). Every design decision below flows from it.

Two money movements happen per completed trip:

1. **Charge** — pull the fare from the rider's saved payment method (card / e-wallet), off-session, at trip completion.
2. **Payout** — credit the driver their net earnings (fare − commission) and settle to their bank account.

Both are ledgered in Postgres so that at any moment we can answer: *what did the rider pay, what did Teeko earn, what is owed to the driver, and has it been settled?*

**Charge model (decided):** Riders save a payment method once and are auto-charged off-session when the trip ends — no mid-ride redirect. This matches Grab/Bolt UX and the flow already sketched in `teeko-api-implementation.md`.

**Payout model (decided):** Drivers onboard as **Stripe Connect** accounts. Teeko takes its cut as a Stripe `application_fee`; the remainder lands in the driver's connected account and settles to their bank on a payout schedule (with optional instant cashout).

---

## 2. Guiding Principles

1. **Ledger first.** Every cent that moves is a row. Never derive balances by re-reading Stripe; Stripe is the processor, Postgres is the source of truth for *our* books.
2. **Idempotent everywhere.** Webhooks fire more than once and out of order. Every money-mutating operation is safe to run twice — enforced by unique constraints, not just application checks.
3. **Never trust the client for money.** Fares, commissions, surge, and fees are always (re)computed server-side. The app displays numbers; the backend decides them.
4. **Money is integer sen.** No floats. See §4.
5. **Server-side card handling only.** Raw PANs never touch our backend. The device tokenizes; we store the token/`payment_method` id.
6. **Business logic in services, not routes.** Routes do `auth → validate → call service → format`. Domain rules (commission, refund policy) live in `services/billing/*` so rider, driver, and admin paths can't drift. (Same convention as the rest of the API.)

---

## 3. Provider Stack

| Concern | Provider | Notes |
|---|---|---|
| Card charging (Visa/Mastercard) | **Stripe Payment Intents** | Off-session charge with saved `payment_method`. MYR supported. |
| Driver payouts | **Stripe Connect** (Express accounts) | Handles driver KYC, bank onboarding, payout scheduling, and tax reporting. `application_fee` = commission. |
| Touch 'n Go eWallet | **TNG eWallet SDK** | The sole e-wallet in v1.0. Dominant MY e-wallet (20M+ users). Charged at completion via saved agreement/token. |
| Google Pay | **Google Pay** (card-on-file via Stripe) | Tokenized card presented through Stripe. |
| Webhooks | **Stripe** (`checkout`/`payment_intent`/`charge`/`account`/`payout` events) | Signature-verified. |

> **Why Stripe as the spine:** one integration gives us card charging **and** marketplace payouts (Connect) with idempotency keys, a mature React Native SDK, and MYR support. **TNG** is added alongside because it is table stakes in Malaysia (20M+ users) — but it is wired as an *additional payment method type*, not a second ledger.
>
> **GrabPay is deliberately out of scope.** v1.0 supports exactly one e-wallet — TNG. GrabPay may be revisited post-MVP, but adding it later is a single new branch in `chargeRider()`, not a structural change.

**Provider abstraction.** All rider charges go through a single `chargeRider()` service that switches on `payment_method.type`. Adding a new e-wallet is a new branch, not a new flow. The ledger shape (§16) is provider-agnostic.

---

## 4. Money & Currency Conventions

- **Currency:** MYR only in v1.0. A `currency` column exists on money tables for forward-compat but is always `'myr'`.
- **Storage:** money is stored two ways, deliberately:
  - **`NUMERIC(10,2)`** for human-facing amounts on domain rows (e.g. `trips.fare_rm = 18.50`) — readable, exact, no float error. (Same choice the reference booking-system made with `numeric(10,2)`.)
  - **Integer sen (`BIGINT`)** on the payment/ledger tables and in every Stripe API call. `RM 18.50` → `1850`. Stripe requires the smallest currency unit; keeping the ledger in sen removes all rounding ambiguity.
- **Conversion is centralized:** `toSen(rm)` / `fromSen(sen)` helpers in `lib/money.ts`. Never multiply by 100 inline.
- **Rounding:** all fare/commission math rounds to the sen at the moment of computation, then the split is derived so the parts always sum to the whole (compute commission, driver net = total − commission — never round both independently).

---

## 5. Architecture

```
┌──────────────┐   REST/WS    ┌───────────────────────────────────────────┐
│  Rider App   │◄────────────►│  Node.js API (Fastify, Cloud Run)          │
│  Driver App  │              │                                             │
└──────────────┘              │  routes/                                    │
                              │    rider/payment-methods, trips             │
                              │    driver/connect, earnings, cashout        │
                              │    webhooks/stripe                          │
                              │  services/billing/                          │
                              │    chargeRider · refund · payout ·          │
                              │    commission · reconcile · webhookHandler  │
                              └───────┬───────────────────────┬─────────────┘
                                      │                        │
                          ┌───────────▼─────────┐   ┌──────────▼───────────┐
                          │ PostgreSQL           │   │ Stripe               │
                          │ • payments (ledger)  │   │ • PaymentIntents     │
                          │ • refunds            │◄─►│ • Connect accounts   │
                          │ • driver_earnings    │   │ • Transfers/Payouts  │
                          │ • payouts            │   │ • Webhooks           │
                          │ • payment_methods    │   └──────────────────────┘
                          │ • connect_accounts   │
                          └──────────────────────┘
```

**Runtime:** Node.js 20 LTS, Fastify, Prisma, Postgres (Cloud SQL), `asia-southeast1`. Consistent with `teeko-api-implementation.md`.

---

## 6. The Two Sides of a Trip

A single completed trip produces a fan-out of ledger rows:

```
Trip completes (fare = RM 20.00, commission 10%)
   │
   ├─► CHARGE (rider side)
   │      payments row: kind='trip_fare', amount_sen=2000, status=pending→succeeded
   │      Stripe PaymentIntent (off_session) with transfer_data → driver's Connect acct
   │      application_fee_amount = 200 sen  (Teeko keeps RM 2.00)
   │
   └─► EARNING (driver side)
          driver_earnings row: gross_sen=2000, commission_sen=200, net_sen=1800
          net settles into driver's Connect balance → payout to bank
```

**Two ways to split with Stripe Connect** — Teeko uses **Destination charges** (`transfer_data.destination` + `application_fee_amount`) so a single PaymentIntent both charges the rider and routes the driver's cut atomically. This avoids a separate transfer step and keeps the charge and the payout tied to one Stripe object.

> **Fallback for TNG:** the TNG e-wallet is charged *to Teeko's account* (not via a Connect destination charge). In that case the driver's net is moved with a **separate Stripe Transfer** to the connected account after the charge succeeds. `chargeRider()` returns a normalized result so the downstream earning/payout logic is identical regardless of method.

---

## 7. Rider — Payment Methods

Tokenization happens **on the device**. The backend never sees a raw card number (PCI SAQ-A scope).

**`POST /rider/payment-methods`** — body `{ type: 'card' | 'tng' | 'google_pay', token }`

```typescript
// services/billing/paymentMethods.ts
async function addPaymentMethod(riderId: string, type: PmType, token: string) {
  let externalId: string, label: string;

  if (type === 'card' || type === 'google_pay') {
    const customer = await getOrCreateStripeCustomer(riderId); // stripe_customer_id on users
    const pm = await stripe.paymentMethods.attach(token, { customer: customer.id });
    externalId = pm.id;                                   // pm_xxx — off-session reusable
    label = `${pm.card!.brand.toUpperCase()} •••• ${pm.card!.last4}`;
  } else {
    // TNG: token is a reusable payment agreement id from the TNG eWallet SDK
    externalId = token;
    label = "Touch 'n Go eWallet";
  }

  const isFirst = (await prisma.paymentMethod.count({ where: { user_id: riderId } })) === 0;
  const pm = await prisma.paymentMethod.create({
    data: { user_id: riderId, type, external_id: externalId, label, is_default: isFirst },
  });
  return { method_id: pm.id, label: pm.label, is_default: pm.is_default };
}
```

- Each rider has **one Stripe Customer** (`users.stripe_customer_id`), created lazily.
- Cards are attached as **off-session reusable** so they can be charged after the trip without the rider present.
- The **first** method added becomes default; `PUT /rider/payment-methods/:id/default` changes it.
- `DELETE /rider/payment-methods/:id` detaches from Stripe and soft-deletes the row (kept for historical `payments.payment_method_id` references).

---

## 8. Rider — Charging at Trip Completion

The charge is initiated by the **driver's** `POST /trip/:id/complete` call (server-side), not the rider. The rider is off-session by design.

```typescript
// services/billing/chargeRider.ts
async function chargeTripFare(trip: Trip) {
  const pm = await prisma.paymentMethod.findUnique({ where: { id: trip.payment_method_id } });
  const amountSen = toSen(trip.final_fare_rm);
  const { commissionSen } = computeCommission(amountSen, trip); // §13
  const driverAcct = await getConnectAccountId(trip.driver_id!);

  // 1. Create the ledger row FIRST, pending, so a crash mid-charge is recoverable.
  const payment = await prisma.payment.create({
    data: {
      trip_id: trip.id, rider_id: trip.rider_id, driver_id: trip.driver_id,
      kind: 'trip_fare', method_type: pm.type,
      amount_sen: amountSen, commission_sen: commissionSen,
      currency: 'myr', status: 'pending',
    },
  });

  try {
    if (pm.type === 'card' || pm.type === 'google_pay') {
      const customer = await getStripeCustomerId(trip.rider_id);
      const intent = await stripe.paymentIntents.create({
        amount: amountSen, currency: 'myr',
        customer, payment_method: pm.external_id,
        off_session: true, confirm: true,
        application_fee_amount: commissionSen,             // Teeko's cut
        transfer_data: { destination: driverAcct },        // driver's net, atomically
        metadata: { trip_id: trip.id, payment_id: payment.id },
      }, { idempotencyKey: `charge_${payment.id}` });      // Stripe-level idempotency

      await markPaymentResult(payment.id, intent);         // pending→succeeded/requires_action/failed
    } else {
      await chargeEwallet(pm, amountSen, payment.id);      // TNG + separate Transfer of net
    }
  } catch (err) {
    if (isCardError(err)) return handleChargeFailure(payment.id, err); // §11
    throw err;
  }
  return payment;
}
```

Key points:

- **`idempotencyKey: charge_<payment.id>`** — if the complete-trip request is retried, Stripe returns the *same* PaymentIntent instead of double-charging. This is the single most important safety property of the charge path.
- **Ledger row precedes the Stripe call.** If the process dies after `paymentIntents.create` but before we record the result, the pending row + reconciliation job (§15) recovers it.
- The **agreed fare is locked** at request time (`trips.fare_rm`). Surge changing mid-trip never changes what the rider pays. `final_fare_rm` may differ only for legitimate reasons (waiting time, tolls) and is computed server-side.
- On success, push the receipt (FCM) and email it (SendGrid). The receipt links to the Stripe `receipt_url` stored on the payment row.

---

## 9. Cancellation Fees

Cancellation is a **charge with `kind='cancellation_fee'`** on the same rails, using the same off-session PaymentIntent path (no destination transfer — or a partial one if the driver is compensated).

Policy (from `teeko-api-implementation.md`, centralized in `services/billing/cancellationPolicy.ts`):

| Trip status at cancel | Fee |
|---|---|
| `searching` | none |
| `matched` / `en_route_to_pickup`, driver <2 min in | none |
| `arrived_at_pickup`, driver waited >5 min | **RM 3.00** |
| Rider no-show after grace | RM 3.00 |

- The fee is configurable via `CANCELLATION_FEE_RM`.
- If a fee applies, a portion may be paid to the driver (Connect transfer) as compensation for the wasted trip — configurable `CANCELLATION_DRIVER_SHARE`.
- No saved payment method on file → fee is recorded as **rider debt** (§11), settled before the next ride.

---

## 10. Refunds

Refunds reverse a `succeeded` payment fully or partially, and — critically for a marketplace — must decide **who eats the cost**: Teeko, the driver, or split.

```typescript
// services/billing/refund.ts
async function issueRefund(paymentId: string, opts: {
  amountSen?: number;          // omit = full
  reason: RefundReason;        // 'rider_complaint' | 'driver_fault' | 'overcharge' | 'duplicate'
  reverseTransfer: boolean;    // true = claw back driver's cut too
  by: string;                  // admin id (audit)
}) {
  const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
  if (payment.status !== 'succeeded') throw new AppError('PAYMENT_NOT_REFUNDABLE', 409);

  const refund = await stripe.refunds.create({
    payment_intent: payment.stripe_payment_intent_id,
    amount: opts.amountSen,
    reverse_transfer: opts.reverseTransfer,               // pulls back from driver's Connect balance
    refund_application_fee: !opts.reverseTransfer ? false : true,
    metadata: { payment_id: paymentId, reason: opts.reason, admin_id: opts.by },
  }, { idempotencyKey: `refund_${paymentId}_${opts.amountSen ?? 'full'}` });

  await prisma.refund.create({
    data: {
      payment_id: paymentId, stripe_refund_id: refund.id,
      amount_sen: opts.amountSen ?? payment.amount_sen,
      reason: opts.reason, reversed_transfer: opts.reverseTransfer,
      issued_by: opts.by, status: 'pending',              // → 'succeeded' on charge.refunded webhook
    },
  });
  // Do NOT flip payment.status here — wait for the webhook (§14) so books match Stripe.
}
```

- **`reverse_transfer`** decides cost attribution: `true` claws the money back from the driver (driver at fault); `false` means Teeko absorbs it (goodwill / platform error).
- Refund rows are `pending` until the `charge.refunded` webhook confirms — same pattern as the reference booking-system.
- **v1 is admin-triggered** refunds (support console). Automated policy-driven refunds (e.g. auto-refund on verified overcharge) is a fast-follow, matching the reference's "refund service, expanded later" posture.

---

## 11. Failed Payments & Rider Debt

Off-session charges fail (insufficient funds, expired card, `authentication_required`). The trip already happened — the driver must still be paid.

```
Charge fails
   │
   ├─ Driver is paid regardless (Teeko fronts the net from platform balance).
   │
   ├─ payments.status = 'failed';  create rider_debt row (amount owed).
   │
   ├─ Rider notified: "Payment couldn't be completed. Update your payment method."
   │
   └─ Retry ladder:
        • authentication_required → prompt rider to complete 3DS in-app, then retry on-session
        • insufficient_funds      → retry job after 6h / 24h (max 3 attempts)
        • hard decline            → block new rides until debt cleared
```

- **`rider_debt`** table tracks the outstanding balance per rider. A rider with unpaid debt is blocked from booking (`POST /ride/request` → `422 OUTSTANDING_BALANCE`) until settled.
- On the next successful method update or app open, the debt is charged first (`kind='debt_settlement'`).
- The driver is **never** exposed to the rider's payment failure — driver earnings are guaranteed at completion; collection risk sits with Teeko. This is a deliberate marketplace-trust decision.

---

## 12. Driver — Payouts via Stripe Connect

### 12.1 Onboarding

Drivers create a **Stripe Connect Express** account during driver onboarding (alongside document upload).

```typescript
// POST /driver/connect/onboard  → returns an onboarding URL
async function startConnectOnboarding(driverId: string) {
  let acct = await getConnectAccountId(driverId);
  if (!acct) {
    const account = await stripe.accounts.create({
      type: 'express', country: 'MY',
      capabilities: { transfers: { requested: true } },
      business_type: 'individual',
      metadata: { driver_id: driverId },
    });
    acct = account.id;
    await prisma.connectAccount.create({ data: { driver_id: driverId, stripe_account_id: acct, status: 'onboarding' } });
  }
  const link = await stripe.accountLinks.create({
    account: acct, type: 'account_onboarding',
    refresh_url: `${APP_URL}/driver/connect/refresh`,
    return_url: `${APP_URL}/driver/connect/done`,
  });
  return { onboarding_url: link.url };
}
```

- Stripe collects the driver's **bank account + KYC** (IC, etc.) — Teeko does not store bank details, reducing PCI/PDPA scope.
- A driver **cannot go online** until `connect_accounts.status = 'active'` (`payouts_enabled` true). This is added to the existing `checkDriverEligibility()` gate.
- The `account.updated` webhook keeps `connect_accounts.status` in sync (`onboarding → active → restricted`).

### 12.2 Earnings accrual

Every completed trip writes a `driver_earnings` row (gross / commission / net), exactly as sketched in `teeko-api-implementation.md`. With **destination charges**, the net is *already* in the driver's Stripe balance — the row is our mirror for the earnings dashboard and reconciliation.

### 12.3 Payout to bank

Two modes, both configurable:

| Mode | Mechanism | When |
|---|---|---|
| **Scheduled (default)** | Stripe automatic payouts on the connected account (e.g. daily) | Hands-off; Stripe moves balance → bank |
| **Instant cashout** | `POST /driver/earnings/cashout` → Stripe **Instant Payout** (if driver's bank supports it) | Driver-initiated, once/day cap (`CASHOUT_COOLDOWN_HOURS`) |

```typescript
// POST /driver/earnings/cashout
async function requestCashout(driverId: string) {
  const acct = await getActiveConnectAccountId(driverId);
  const cooldownOk = await checkCashoutCooldown(driverId);      // once per 24h
  if (!cooldownOk) throw new AppError('CASHOUT_COOLDOWN', 429);

  const balance = await stripe.balance.retrieve({ stripeAccount: acct });
  const availableSen = balance.available.find(b => b.currency === 'myr')?.amount ?? 0;
  if (availableSen < toSen(MIN_CASHOUT_RM)) throw new AppError('BELOW_MIN_CASHOUT', 422);

  const payout = await stripe.payouts.create(
    { amount: availableSen, currency: 'myr', method: 'instant' },
    { stripeAccount: acct, idempotencyKey: `cashout_${driverId}_${todayKey()}` },
  );
  await prisma.payout.create({ data: {
    driver_id: driverId, stripe_payout_id: payout.id, amount_sen: availableSen, status: 'pending',
  }});
  return { amount_rm: fromSen(availableSen), status: 'pending' };
}
```

- `payout.paid` / `payout.failed` webhooks update `payouts.status`.
- The `todayKey()` idempotency key prevents a double-tap from firing two payouts.

---

## 13. Commission Model

Teeko's competitive wedge is a **lower commission** than Grab/Bolt (20–25%). Commission is centralized so it can vary by ride type, city, or promo without touching the charge code.

```typescript
// services/billing/commission.ts
function computeCommission(amountSen: number, trip: Trip): { commissionSen: number; netSen: number } {
  const rate = getCommissionRate(trip.ride_type, trip.city);   // default COMMISSION_RATE (e.g. 0.10)
  const commissionSen = Math.round(amountSen * rate);
  return { commissionSen, netSen: amountSen - commissionSen };  // parts always sum to whole
}
```

- Default rate from `COMMISSION_RATE` (10% baseline per api-implementation.md).
- Stored **on the payment row** (`commission_sen`) at charge time — frozen history, so later rate changes don't rewrite past trips.
- Surge multipliers and rider promos are applied to the **fare** (server-side, frozen on the trip) *before* commission is computed, so both sides share the upside/discount proportionally per policy.

---

## 14. Webhooks & Idempotency

Single endpoint: **`POST /webhooks/stripe`** (raw body, signature-verified).

```typescript
// routes/webhooks/stripe.ts
fastify.post('/webhooks/stripe', { config: { rawBody: true } }, async (req, reply) => {
  const sig = req.headers['stripe-signature'] as string;
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(req.rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch {
    return reply.code(400).send({ ok: false, error: { code: 'BAD_SIGNATURE' } });
  }
  await handleStripeEvent(event);        // service layer; throws → 500 → Stripe retries
  return reply.code(200).send({ received: true });
});
```

Events handled:

| Event | Action |
|---|---|
| `payment_intent.succeeded` | `payments.status → succeeded`; store `receipt_url`; write `driver_earnings`; push receipt |
| `payment_intent.payment_failed` | `payments.status → failed`; open `rider_debt`; notify rider (§11) |
| `charge.refunded` | matching `refunds.status → succeeded`; `payments.status → refunded/partially_refunded` |
| `account.updated` | sync `connect_accounts.status` (payouts_enabled) |
| `payout.paid` / `payout.failed` | update `payouts.status` |

**Idempotency — three layers:**

1. **Event-level:** every webhook `event.id` is inserted into a `webhook_events` table with `onConflictDoNothing`. Seen before → ack 200 and skip. (Stripe re-delivers.)
2. **Charge-level:** the `idempotencyKey` on `paymentIntents.create` / `refunds.create` / `payouts.create` makes the *Stripe* call safe to retry.
3. **DB-level:** unique constraint on `payments.stripe_payment_intent_id` and `refunds.stripe_refund_id` is the backstop — a duplicate insert is a no-op, not a double-credit.

This mirrors the reference booking-system's "check status, `onConflictDoNothing`, unique constraint backstop" strategy, extended to the payout events e-hailing adds.

---

## 15. Reconciliation

Because the charge is off-session and asynchronous, a nightly job closes the gap between our ledger and Stripe.

```typescript
// jobs/reconcilePayments.ts  (Cloud Scheduler → Cloud Run job, 03:00 MYT)
// 1. Find payments stuck in 'pending' older than 15 min → query Stripe PI status → resolve.
// 2. Sum succeeded payments vs Stripe balance transactions for the day → flag mismatches to #finance.
// 3. Find completed trips with NO payment row (crash between complete and charge) → charge now.
// 4. Find driver_earnings with no corresponding Connect transfer (e-wallet path) → retry transfer.
```

A **`POST /trip/:id/sync-payment`** endpoint provides the same idempotent recovery on demand (client/support fallback when a webhook is delayed) — the direct analog of the reference's `sync-session` endpoint.

---

## 16. Database Schema

Money-related tables. (Non-payment tables — `trips`, `users`, `vehicles`, etc. — live in `teeko-api-implementation.md §9`; the columns referenced here already exist there.)

```sql
-- Rider payment methods (device-tokenized; no raw PANs)
CREATE TABLE payment_methods (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type        VARCHAR(20) NOT NULL,          -- 'card' | 'tng' | 'google_pay'
  external_id TEXT NOT NULL,                 -- Stripe pm_xxx OR wallet agreement id
  label       VARCHAR(100),                  -- 'VISA •••• 4242'
  is_default  BOOLEAN DEFAULT false,
  deleted_at  TIMESTAMPTZ,                   -- soft delete; history rows still reference it
  created_at  TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_pm_user ON payment_methods(user_id) WHERE deleted_at IS NULL;

-- Rider charge ledger (one row per money-pull; source of truth for our books)
CREATE TABLE payments (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id                  UUID REFERENCES trips(id),
  rider_id                 UUID NOT NULL REFERENCES users(id),
  driver_id                UUID REFERENCES users(id),
  payment_method_id        UUID REFERENCES payment_methods(id),
  kind                     VARCHAR(24) NOT NULL,     -- 'trip_fare'|'cancellation_fee'|'debt_settlement'|'tip'
  method_type              VARCHAR(20) NOT NULL,     -- snapshot of pm.type at charge time
  amount_sen               BIGINT NOT NULL,          -- total charged to rider, in sen
  commission_sen           BIGINT NOT NULL DEFAULT 0,-- Teeko's cut, frozen at charge time
  currency                 VARCHAR(3) NOT NULL DEFAULT 'myr',
  status                   VARCHAR(24) NOT NULL DEFAULT 'pending',
                           -- 'pending'|'succeeded'|'failed'|'requires_action'
                           -- |'refunded'|'partially_refunded'
  stripe_payment_intent_id TEXT,                     -- pi_xxx
  receipt_url              TEXT,
  failure_code             TEXT,                     -- Stripe decline_code on failure
  created_at               TIMESTAMPTZ DEFAULT now(),
  updated_at               TIMESTAMPTZ DEFAULT now()
);
CREATE UNIQUE INDEX uq_payments_pi ON payments(stripe_payment_intent_id)
  WHERE stripe_payment_intent_id IS NOT NULL;         -- idempotency backstop
CREATE INDEX idx_payments_rider  ON payments(rider_id, created_at);
CREATE INDEX idx_payments_trip   ON payments(trip_id);
CREATE INDEX idx_payments_status ON payments(status);

-- Refunds (partial or full reversals of a payment)
CREATE TABLE refunds (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id        UUID NOT NULL REFERENCES payments(id),
  stripe_refund_id  TEXT,
  amount_sen        BIGINT NOT NULL,
  reason            VARCHAR(30) NOT NULL,   -- 'rider_complaint'|'driver_fault'|'overcharge'|'duplicate'
  reversed_transfer BOOLEAN DEFAULT false,  -- true = clawed back from driver
  status            VARCHAR(16) DEFAULT 'pending',  -- 'pending'|'succeeded'|'failed'
  issued_by         UUID REFERENCES users(id),      -- admin (audit)
  created_at        TIMESTAMPTZ DEFAULT now()
);
CREATE UNIQUE INDEX uq_refunds_stripe ON refunds(stripe_refund_id)
  WHERE stripe_refund_id IS NOT NULL;

-- Driver earnings mirror (per completed trip)
CREATE TABLE driver_earnings (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id      UUID NOT NULL REFERENCES users(id),
  trip_id        UUID NOT NULL REFERENCES trips(id),
  payment_id     UUID REFERENCES payments(id),
  gross_sen      BIGINT NOT NULL,
  commission_sen BIGINT NOT NULL,
  net_sen        BIGINT NOT NULL,
  transferred    BOOLEAN DEFAULT false,   -- true once in driver's Connect balance
  created_at     TIMESTAMPTZ DEFAULT now()
);
CREATE UNIQUE INDEX uq_earning_trip ON driver_earnings(trip_id);  -- one earning per trip
CREATE INDEX idx_earning_driver ON driver_earnings(driver_id, created_at);

-- Driver Stripe Connect accounts
CREATE TABLE connect_accounts (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  stripe_account_id TEXT NOT NULL,
  status            VARCHAR(16) DEFAULT 'onboarding', -- 'onboarding'|'active'|'restricted'
  payouts_enabled   BOOLEAN DEFAULT false,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now(),
  UNIQUE(driver_id),
  UNIQUE(stripe_account_id)
);

-- Driver payouts to bank (instant cashouts + scheduled)
CREATE TABLE payouts (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id        UUID NOT NULL REFERENCES users(id),
  stripe_payout_id TEXT,
  amount_sen       BIGINT NOT NULL,
  method           VARCHAR(12) DEFAULT 'standard',  -- 'standard'|'instant'
  status           VARCHAR(16) DEFAULT 'pending',   -- 'pending'|'paid'|'failed'
  created_at       TIMESTAMPTZ DEFAULT now()
);
CREATE UNIQUE INDEX uq_payouts_stripe ON payouts(stripe_payout_id)
  WHERE stripe_payout_id IS NOT NULL;

-- Outstanding rider balance (failed charges)
CREATE TABLE rider_debt (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rider_id    UUID NOT NULL REFERENCES users(id),
  payment_id  UUID REFERENCES payments(id),   -- the charge that failed
  amount_sen  BIGINT NOT NULL,
  status      VARCHAR(16) DEFAULT 'open',      -- 'open'|'settled'|'written_off'
  created_at  TIMESTAMPTZ DEFAULT now(),
  settled_at  TIMESTAMPTZ
);
CREATE INDEX idx_debt_open ON rider_debt(rider_id) WHERE status = 'open';

-- Webhook idempotency ledger
CREATE TABLE webhook_events (
  id          TEXT PRIMARY KEY,               -- Stripe event.id (evt_xxx)
  type        VARCHAR(60) NOT NULL,
  received_at TIMESTAMPTZ DEFAULT now()
);

-- users gains one column:
--   stripe_customer_id TEXT UNIQUE   (rider side, lazily created)
```

**Design notes carried from the reference:**
- Money on ledger tables is **integer sen** (`BIGINT`); domain-facing fare stays `NUMERIC(10,2)`.
- **Partial unique indexes** (`WHERE ... IS NOT NULL`) give idempotency without blocking rows that legitimately have a null external id (e.g. a pending charge before the PI exists).
- **Frozen history:** `commission_sen`, `method_type` are snapshotted on the payment; policy changes never rewrite past rows.
- **Soft delete** on payment methods so historical charges keep a valid FK.

---

## 17. Tax — SST & LHDN e-Invoicing

- **SST:** Malaysian e-hailing fares are currently treated as service-tax-relevant depending on operator turnover thresholds. A `tax_sen` column can be added to `payments` if/when Teeko crosses the SST registration threshold; the fare engine would then compute `tax_sen` and include it in `amount_sen`. **Deferred until registration is required** — flagged here so the schema can absorb it without a rewrite.
- **LHDN e-Invoicing (MyInvois):** Malaysia's phased e-invoicing mandate applies to e-hailing operators. v1.0 stores everything needed to generate a compliant e-invoice per trip (parties, amount, tax, timestamp). Actual MyInvois submission is a **post-MVP integration** (consistent with the PRD deferring the APAD filing itself while the system must *support* it).
- **Driver tax:** Stripe Connect issues the driver's payout records; Teeko provides an annual earnings statement from `driver_earnings`. Drivers are independent contractors responsible for their own tax.

---

## 18. Frontend Integration

### Mobile SDK support

Stripe is fully mobile-native — the entire rider/driver payment surface runs on Stripe's first-party **`@stripe/stripe-react-native`** SDK, which is **Expo-compatible** via its config plugin (no ejecting; works with EAS Build — it does *not* run in Expo Go, so it's tested on a dev build).

| Capability | How it works on mobile |
|---|---|
| **Add a card** | `PaymentSheet` in *setup* mode — Stripe's prebuilt, PCI-compliant card UI. Card data goes device → Stripe directly; it never touches Teeko's JS or backend (SAQ-A scope). Returns a reusable `pm_xxx`. |
| **Google Pay / Apple Pay** | Native wallet buttons in the SDK, tokenized into a Stripe `payment_method`. |
| **Charging after the trip** | **No mobile UI needed.** The card is charged off-session by the backend (§8) — the app isn't involved for the vast majority of trips. |
| **3D Secure** | When a charge returns `requires_action`, the app calls the SDK's `handleNextAction` on next foreground to present the bank auth screen, then the charge is retried. |
| **Driver Connect onboarding** | Stripe-hosted onboarding opened in an in-app browser; returns via deep link (§12.1). |

Because Teeko charges off-session, the mobile SDK is only exercised at **payment-method setup** and the occasional **3DS step** — not on every ride. TNG remains a **separate native SDK** (its own in-app flow + `teeko://payment-callback` deep link); it is not part of the Stripe SDK.

### Rider app (React Native + Expo)

- **`@stripe/stripe-react-native`** — use **PaymentSheet** in *setup* mode to add & tokenize a card without charging; the resulting `payment_method` id (`pm_xxx`) is sent to `POST /rider/payment-methods`. The device, not the backend, handles card entry (PCI SAQ-A).
- **3D Secure / `requires_action`:** if an off-session charge needs authentication, the backend flags the trip; the app opens the Stripe SDK's `handleNextAction` on next foreground to complete 3DS, then the charge is retried on-session.
- **E-wallet (TNG):** the TNG eWallet SDK returns a reusable agreement token via deep-link (`teeko://payment-callback`) — Expo Router deep linking (already in the stack) handles the return.
- **Google Pay:** presented through the Stripe SDK's Google Pay button, producing a Stripe `payment_method`.
- Receipts render from the `payments` row (`amount`, `commission` hidden from rider, `receipt_url` for the itemized Stripe receipt).

### Driver app

- **Connect onboarding:** open `onboarding_url` (from §12.1) in an in-app browser; return via `return_url` deep link.
- **Earnings dashboard:** reads `GET /driver/earnings` (aggregates `driver_earnings`); **Cashout** button hits `POST /driver/earnings/cashout`.
- Payout status surfaced from `payouts.status`.

### Admin panel (React web)

- **Refund console:** search a trip → view its `payments`/`refunds` → issue refund (§10) with reason + `reverse_transfer` toggle.
- **Reconciliation dashboard:** surfaces mismatches from the nightly job (§15).
- All refund/adjustment actions write to the `audit_log`.

---

## 19. Security, PCI & PDPA

| Concern | Implementation |
|---|---|
| **PCI scope** | Cards tokenized on-device via Stripe SDK; backend stores only `pm_xxx`. Scope stays **SAQ-A**. Raw PANs never transit Teeko servers. |
| **Driver bank details** | Held by Stripe Connect, not Teeko — removes bank data from our PDPA footprint. |
| **Webhook auth** | HMAC signature verification on every event; raw-body parsing required. |
| **Idempotency keys** | On every money-mutating Stripe call — no double charges/refunds/payouts. |
| **Least privilege** | `STRIPE_SECRET_KEY` in GCP Secret Manager; only the API service reads it. Restricted key scoped to needed resources. |
| **Amounts server-authoritative** | Fare, commission, fee, surge all (re)computed backend-side; client fare is display-only. |
| **Audit** | Every admin refund/adjustment → `audit_log(admin_id, action, target_id, amount_sen, ts)`. |
| **PDPA residency** | Payment ledger in Cloud SQL `asia-southeast1`. Stripe processes MY cards; data-processing agreement in place. |

---

## 20. Environment Variables

```bash
# Stripe (charging + Connect payouts)
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_CONNECT_CLIENT_ID=ca_...            # for Express onboarding

# E-wallet (TNG only)
TNG_MERCHANT_ID=...
TNG_API_KEY=...

# Business rules (mirror teeko-api-implementation.md)
COMMISSION_RATE=0.10
CANCELLATION_FEE_RM=3.00
CANCELLATION_DRIVER_SHARE=0.50
CASHOUT_COOLDOWN_HOURS=24
MIN_CASHOUT_RM=10.00

# App
APP_URL=https://app.teeko.my
CURRENCY=myr
```

> Per repo convention, any new BE env var must also be reflected in the deploy workflow and `.env.example`.

---

## 21. Deferred — Teeko Wallet

The PRD defers a **Teeko Wallet** (prepaid balance topped up via FPX/card, spent on rides). When built, it slots into this design cleanly:

- A `wallet_accounts` + `wallet_transactions` (double-entry) ledger, mirroring the reference booking-system's credit/entitlement model (`client_packages` → balance that decrements).
- `payment_methods.type = 'wallet'` becomes a new branch in `chargeRider()` — decrement wallet balance instead of hitting Stripe.
- Top-ups via **FPX** (iPay88/Billplz) — the Malaysian bank-transfer rails noted in the tech stack as better suited for top-ups than in-trip payments.

Keeping it out of v1.0 avoids holding customer float (an e-money licensing question with BNM) until scale justifies it. The ledger-first design above means adding it later is additive, not a rewrite.

---

*References: `teeko-api-implementation.md` (charge/earning/cashout sketches, trip schema), `teeko-tech-stack.md` (§12 Payments rationale), `teeko-prd.md` (commission positioning, deferred wallet), and the reference architecture of `yoga-sadhana/booking-system` (Stripe ledger + webhook idempotency + numeric money patterns).*

*Updated 2026-07-02.*

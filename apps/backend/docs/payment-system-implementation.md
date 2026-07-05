# Payment System — Implementation Notes

> **Implements:** [`docs/v0.1/tech/teeko-payment-system.md`](../../../docs/v0.1/tech/teeko-payment-system.md)
> **Scope:** `apps/backend` (Fastify + Drizzle + PostgreSQL/PostGIS)
> **Status:** Implemented & verified end-to-end against local Postgres (v0.1 runs on mock gateways; no real money moves).
> **Date:** 2026-07-04

---

## 1. Decisions taken

| Area | Decision | Why |
|---|---|---|
| **Payout model** | **Stripe Connect Express** (destination charges, `application_fee` = commission) | Matches the spec. The earlier scaffold's weekly-payout-bin model was retired. |
| **Provider integration** | **Mock-capable adapters** behind an interface | v0.1 has no keys; the mock runs the whole flow locally. v1.0 swaps in the real `stripe` SDK via one factory change. |
| **Money** | Integer **`*Cents`** (sen) on all ledger tables & provider calls | Repo-wide convention (`finalFareCents`, `baseCents`, …). No floats. |
| **Method types** | `cash \| card \| tng \| google_pay` | `cash` = driver-collected (Malaysia market); GrabPay dropped per spec. |

Legacy tables removed: `driver_payouts`, `driver_bank_accounts`, `early_cashout_requests`, and the duplicate `payment_methods` that lived in `riders.ts`. Incentive FKs (`driver_bonuses`, `driver_incentive_progress` → `paid_payout_id`) were repointed to the new `payouts` table.

---

## 2. Database schema

Migration: **`drizzle/0007_add_payment_system.sql`** (hand-authored + registered in `_journal.json`; applies cleanly on the full 0000→0007 chain).

New tables (`src/db/schema/payments.ts`), all money in integer sen:

| Table | Purpose | Idempotency guard |
|---|---|---|
| `payment_methods` | Device-tokenized methods (PCI SAQ-A); soft-deleted | — |
| `payments` | Charge ledger — one row per money pull (source of truth) | `uq_payments_pi` (partial unique on `stripe_payment_intent_id`) |
| `refunds` | Partial/full reversals; `reversed_transfer` cost attribution | `uq_refunds_stripe` |
| `driver_earnings` | Per-trip gross/commission/net mirror | `uq_earning_trip` (one per trip) |
| `connect_accounts` | Driver Stripe Connect account + status | unique `driver_id`, `stripe_account_id` |
| `payouts` | Bank payouts (standard + instant cashout) | `uq_payouts_stripe` |
| `rider_debt` | Outstanding balance from failed off-session charges | — |
| `webhook_events` | Stripe `event.id` dedup ledger | PK on `event.id` |

Plus `users.stripe_customer_id` (lazy, unique).

---

## 3. Domain services

### `src/modules/payments`
- **`service.ts`** — `paymentsService`:
  - Methods: `addMethod` / `listMethods` / `setDefault` / `deleteMethod` (lazy Stripe customer; on-device token → `pm_xxx` / TNG agreement).
  - `chargeTripFare` / `chargeCancellationFee` → `charge()`: writes the pending ledger row **first**, then charges. Card/Google Pay = destination charge (`application_fee_amount` + `transfer_data.destination`); TNG = charge-to-Teeko + separate transfer; cash = recorded, driver collects. `idempotencyKey: charge_<payment.id>`.
  - `failCharge`: on decline → `payments.failed` + open `rider_debt`, **driver is still credited** (collection risk sits with Teeko).
  - `issueRefund`: admin-triggered; refund row stays `pending` until the `charge.refunded` webhook.
  - `handleStripeEvent`: dedups via `webhook_events`, handles `payment_intent.succeeded|payment_failed`, `charge.refunded`, and fans `account.updated`/`payout.*` to the payouts service.
  - `assertNoOutstandingDebt`: booking gate (§11).
- **`commission.ts`** — `computeCommission` (rate from `COMMISSION_RATE`; net = amount − commission so parts sum to whole).
- **`repo.ts`** — all Drizzle queries (private to the module).

### `src/modules/payouts`
- **`service.ts`** — `payoutsService`: Connect Express onboarding (`startOnboarding`, hosted `accountLinks`), `getConnectStatus` / `canDriverGoOnline` gate, `getEarnings` dashboard (lifetime + today + recent + payout history), `requestCashout` (instant payout, `MIN_CASHOUT_CENTS`, once-per-`CASHOUT_COOLDOWN_HOURS`), and the `account.updated` / `payout.paid|failed` webhook sync.
- **`repo.ts`** — Connect accounts, payouts, and earnings aggregation reads.

### Support
- **`src/lib/money.ts`** — `toCents` / `fromCents` / `formatRm`.
- **`src/external/stripe.ts`** — `StripeGateway` interface + `MockStripeGateway`; `createStripeGateway()` returns the mock unless a real SDK+key is wired.
- **`src/external/tng.ts`** — `TngGateway` + mock.
- **`src/jobs/reconcile.worker.ts`** — `chargeUnbilledCompletedTrips`, `findStalePendingPayments`, `syncTripPayment` (on-demand idempotent recovery).

---

## 4. HTTP surface

| Method | Route | Purpose |
|---|---|---|
| `GET` | `/rider/payments` | List saved methods |
| `POST` | `/rider/payments` | Add a method (`{ type, token }`) |
| `PUT`/`POST` | `/rider/payments/:id/default` | Set default |
| `DELETE` | `/rider/payments/:id` | Detach + soft-delete |
| `POST` | `/driver/connect/onboard` | Start Connect onboarding → hosted URL |
| `GET` | `/driver/connect/status` | Onboarding / payouts-enabled status |
| `GET` | `/driver/earnings` | Earnings dashboard |
| `POST` | `/driver/earnings/cashout` | Instant cashout |
| `GET` | `/admin/payments/trip/:tripId` | Payments + refunds for a trip |
| `GET` | `/admin/payments/:id` | Payment detail |
| `POST` | `/admin/payments/:id/refund` | Issue refund (`reason`, `reverseTransfer`) |
| `POST` | `/admin/payments/trip/:tripId/sync` | On-demand payment recovery |
| `POST` | `/webhooks/stripe` | Signature-verified Stripe events |

The rider charge is initiated **server-side** from `driverCompleteTrip` (`modules/trips/service.ts`) — riders are off-session by design. Booking (`POST /rider/trips`) is blocked while a rider owes money.

---

## 5. Environment

New (all optional in v0.1 → mock; see `.env.example` and `src/config/env.ts`):
```
STRIPE_SECRET_KEY  STRIPE_WEBHOOK_SECRET  STRIPE_CONNECT_CLIENT_ID
TNG_MERCHANT_ID    TNG_API_KEY
CANCELLATION_DRIVER_SHARE=0.5
CASHOUT_COOLDOWN_HOURS=24   MIN_CASHOUT_CENTS=1000
APP_URL=https://app.teeko.my   CURRENCY=myr
```

---

## 6. Verification

- **Typecheck:** `tsc --noEmit` clean (0 errors).
- **Migration:** full 0000→0007 chain applies on a fresh Postgres; all 8 tables, `users.stripe_customer_id`, and 7 enums confirmed present.
- **Runtime smoke (18 assertions, real Postgres):** card charge + 10% commission split + `driver_earnings` transferred; decline → `rider_debt` opened + driver still paid + booking blocked; webhook idempotency (no double credit); Connect activation via `account.updated`; instant cashout + 24h cooldown; dashboard aggregation.

---

## 7. v1.0 TODO (production wiring)

1. `pnpm add stripe`; implement the real branch in `createStripeGateway()` (each mock method maps 1:1 to an SDK call — no service changes).
2. Wire the TNG eWallet SDK in `external/tng.ts`.
3. Add a **raw-body** parser on `/webhooks/stripe` and pass `req.rawBody` to `constructEvent` for real HMAC verification.
4. Schedule `reconcile.worker` (Cloud Scheduler → Cloud Run job, 03:00 MYT).
5. Move secrets to GCP Secret Manager; register the new env vars in the deploy workflow.
6. Re-baseline the Drizzle meta snapshot (`pnpm db:generate` once interactively) so future `generate` diffs are accurate.
7. Tax (`tax_sen`) + LHDN MyInvois (§17) when registration thresholds are crossed.

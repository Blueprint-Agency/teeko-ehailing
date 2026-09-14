# Teeko — Stripe Accounts v2 Migration

> **Version:** 0.1
> **Date:** 2026-08-23
> **Status:** Implemented — pending verification against a live test platform
> **Scope:** Driver Connect onboarding moved off the deprecated Accounts v1 API (`POST /v1/accounts`) onto Accounts v2 (`POST /v2/core/accounts`).
> **Depends on:** `teeko-payment-system.md`, `apps/backend/docs/payment-system-implementation.md`
> **Applies to:** v1.0 — Production, and the v0.1 mockup backend.

---

## 1. Why

Driver payout setup (`Set up payouts` → `POST /api/v1/driver/connect/onboard`) failed against a
freshly-created Stripe platform. `stripe.accounts.create` called Accounts **v1**, which Stripe
refuses for new integrations:

```
StripeInvalidRequestError (400, req_fCBDVptFNxWbzp)
Stripe no longer recommends Accounts v1 for new Connect integrations.
Create connected accounts with POST /v2/core/accounts instead.
```

Not a Connect-not-enabled problem — an API-generation problem. The alternative was a dashboard
compatibility flag (`feat_accounts_v1_support`), which we deliberately did **not** take: it parks a
pre-launch codebase on an API Stripe already calls legacy.

## 2. What changed

**SDK:** `stripe@^17.5.0` → `^22.5.0` (`apps/backend/package.json`). Pinned API version moves to
`2026-07-29.dahlia`. 17.x had no `v2.core.accounts` at all, so the upgrade was mandatory, not
cosmetic. Every v1 call we kept — Customers, PaymentMethods, PaymentIntents, Refunds, Payouts,
Balance, Webhooks — typechecks unchanged under dahlia.

**Gateway** (`apps/backend/src/external/stripe.ts`) — the `StripeGateway` interface still hides all
of this from the services:

| Before (v1) | After (v2) |
|---|---|
| `accounts.create({ type: 'express', country, capabilities: { transfers } , business_type })` | `v2.core.accounts.create({ identity: { country, entity_type }, configuration: { recipient: { capabilities: { stripe_balance: { stripe_transfers: { requested: true } } } } }, dashboard: 'express', include: ['configuration.recipient'] })` |
| `accountLinks.create({ account, type: 'account_onboarding', refresh_url, return_url })` | `v2.core.accountLinks.create({ account, use_case: { type: 'account_onboarding', account_onboarding: { configurations: ['recipient'], refresh_url, return_url } } })` |
| `StripeAccount { payouts_enabled, charges_enabled }` | `StripeAccount { payoutsEnabled, transfersEnabled, capabilityStatus }` |

Drivers get **both** the `recipient` and `merchant` configurations — not because they take payments,
but because Malaysian platform rules leave no other option (see below). Only `stripe_transfers` is
*requestable* on `recipient`; the account object reports `stripe_transfers` and `payouts` statuses,
and both must be `active` before a driver can be paid.

Account-link expiry is an ISO-8601 string in v2 (Unix seconds in v1) — converted in the adapter.

### Why drivers are merchants, not just recipients

Three Stripe constraints compose into exactly one legal configuration for a Malaysian platform. We
arrived at it by walking into each error in turn:

1. **`defaults.responsibilities` is mandatory** once `stripe_transfers` is requested —
   *"You must set defaults.responsibilities.{fees,losses}_collector"*. It is the v2 spelling of the
   legacy controller (`controller.fees.payer` / `controller.losses.payments`).
2. **A recipient-only account forces `application`/`application`** —
   *"can only be \"application\" for the set of configurations this account has"*. With no merchant
   configuration there is no charge of the driver's for Stripe to take fees from, and no merchant
   balance for Stripe to underwrite, so the platform must own both.
3. **Malaysian platforms may not create loss-liable accounts** —
   *"Platforms in MY cannot create accounts where the platform is loss-liable, due to risk control
   measures."* Connect in Malaysia is available only where
   [Stripe collects fees and owns loss liability](https://support.stripe.com/questions/connect-availability-for-businesses-located-in-malaysia).

(2) and (3) are mutually exclusive, so recipient-only is impossible for us. Adding the `merchant`
configuration re-opens `stripe`/`stripe` — the legacy **Standard** shape — which is what we now
create:

| | value | why |
|---|---|---|
| `configuration.recipient` | `stripe_balance.stripe_transfers` | receive destination-charge transfers |
| `configuration.merchant` | `card_payments` | required for Stripe-owned responsibilities |
| `fees_collector` | `stripe` | MY platforms can't collect fees themselves |
| `losses_collector` | `stripe` | MY platforms can't be loss-liable |
| `dashboard` | `full` | `express` pairs with application-collected fees |

`stripe_balance.payouts` is never requestable — Stripe derives it — but it *is* reported, under both
configurations, so `toStripeAccount` reads whichever answers.

**Consequences to accept or revisit before launch:**

- Drivers are Standard-equivalent connected accounts with a **full Stripe dashboard** and merchant
  KYC, not the lighter Express recipient onboarding. Heavier for an individual driver.
- With `fees_collector: 'stripe'`, Stripe's processing fee comes off the **connected account's**
  side of a destination charge, not Teeko's. Our 10% commission (`application_fee_amount`) is
  unaffected, but a driver's net is fee-reduced unless we compensate in the fare or the split.
  `computeCommission` (`modules/payments/service.ts`) does not model this today.

**Status is now polled, not just pushed** (`modules/payouts/service.ts`). `getConnectStatus`
re-reads the account from Stripe whenever our row isn't already active, then persists the result.
The driver app polls this endpoint on every return from the hosted flow, so a driver activates the
moment they finish — even if the capability webhook is slow, misconfigured, or (in mock mode) never
fires. Webhooks remain the fast path, not the only path. A provider hiccup falls back to the cached
row rather than blanking the screen.

**Webhooks** (`modules/payouts/service.ts`) handle three shapes now: v1 `account.updated` (still
emitted for v2 accounts, flags inline), and the v2 *thin* events
`v2.core.account[configuration.recipient].capability_status_updated` and `v2.core.account.updated`,
whose payloads name the account but carry no state — so we re-read the account.

**Mock gateway** mirrors the new shapes, and `accounts.retrieve` reports an active account. Combined
with the status re-poll, that means mock mode now activates a driver end to end with no webhook
curl — previously impossible.

**Driver app** (`apps/driver`): `onboarding` renders as "Verification in progress / Continue setup"
instead of falling through to the first-run "Set up payouts" card, and `ConnectStatus` includes it.

## 3. Still to verify

None of this has run against a real Stripe test platform yet — typecheck only.

1. Create a driver end to end on a test platform with `feat_accounts_v1_support` **off**. That is
   the only proof the migration is real.
2. Confirm a Malaysian recipient reaches `payouts: active` after hosted onboarding, and that the
   platform's own country is allowed to create `MY` connected accounts (error code
   `cross_border_connected_account_creation_not_allowed` if not).
3. Confirm destination charges still route: `transfer_data.destination` + `application_fee_amount`
   with a v2 account id (`modules/payments/service.ts:201`).
4. Confirm instant cashout works for a `MY` recipient (`payouts.create({ stripeAccount })`).
5. Decide whether to register a v2 **event destination** for the thin events. Thin events are
   delivered through event destinations rather than classic webhook endpoints, and verify with
   `parseThinEvent` rather than `constructEvent` — untested here. The status re-poll means
   activation does not depend on it.
6. Re-run the payment smoke suite (§6 of the implementation doc).

## 4. Not migrated

Rider-side Customers and PaymentMethods stay on v1. Accounts v2 can represent customers, but there
is no failure driving that change and it would touch the whole rider charge path. `teeko-payment-
system.md` §12 still describes v1 Express onboarding and should be refreshed when that spec is next
revised.

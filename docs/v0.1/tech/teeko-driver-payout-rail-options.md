# Teeko — Driver Payout Rail: Options

> **Version:** 0.1
> **Date:** 2026-08-23
> **Status:** Decision pending — no code written for either option
> **Scope:** How Teeko pays drivers their trip earnings. Rider-side collection is out of scope; riders pay by card/e-wallet through Stripe either way.
> **Depends on:** `teeko-payment-system.md`, `teeko-stripe-accounts-v2-migration.md`
> **Applies to:** v1.0 — Production. v0.1's mock gateway is unaffected by this choice.

---

## 1. Why this is open

Stripe Connect onboarding asks a Malaysian driver to register as a business. That is not a
misconfiguration — it is forced:

1. Drivers need the `recipient` configuration to receive our destination-charge transfers.
2. A recipient-only account forces `responsibilities: application/application`.
3. **Malaysian platforms may not create loss-liable accounts.**

(2) and (3) are mutually exclusive, so we had to add the `merchant` configuration, which brings
merchant KYC: business profile, industry/MCC, product description, sometimes a website. Full
derivation in `teeko-stripe-accounts-v2-migration.md` §2.

The question is whether that onboarding cost is worth what Connect buys — Teeko never touching
driver money.

## 2. What stays the same either way

- `driver_earnings` already mirrors every trip's gross / commission / net in integer sen. That
  ledger is the source of truth for what a driver is owed regardless of rail.
- `computeCommission` and the 10% split are untouched.
- Cash trips are untouched: the driver keeps the fare and owes Teeko commission.
- Rider charging, refunds, rider debt, and the 3DS path are untouched.
- The driver-facing surfaces stay: `payouts.tsx` (setup + status) and the Earnings tab's cashout.

## 3. Option A — Stripe Connect, with prefill

Keep what is built. Reduce onboarding friction by sending everything Teeko already knows at account
creation so Stripe stops asking the driver for it: `defaults.profile.product_description`,
`doing_business_as`, MCC `4121` (taxi/limousine), Teeko's URL, plus the driver's name, email, phone
and address from their approved application.

**Effort:** ~1 day, plus a test-account round trip to see what Stripe still asks.

**What it does not fix:** merchant-grade identity verification remains. Prefilling the business
profile removes typing, not scrutiny. We cannot promise a bank-details-only flow.

| | |
|---|---|
| Driver enters | Personal identity, ID document, DOB, address, bank account — plus whatever merchant fields Stripe won't let us prefill |
| Teeko custodies funds | **No** — the driver's net lands in their own Stripe balance at charge time |
| Fraud / negative balance | Stripe (`losses_collector: 'stripe'`) |
| Stripe processing fee | Comes off the **driver's** side of a destination charge; their net is fee-reduced |
| Payout mechanics | Already built: Stripe's standard schedule, plus instant cashout with a 24h cooldown and `MIN_CASHOUT_CENTS` floor |
| Compliance surface | Small. Teeko is a platform, not a payment intermediary |
| Ongoing ops | Near zero — Stripe reconciles, retries and reports |

## 4. Option B — Bank details + DuitNow

Teeko collects rider money into its own Stripe account and disburses to drivers itself.

**Charge path change:** drop `transfer_data.destination` and `application_fee_amount` from
`paymentIntents.create` (`modules/payments/service.ts:201`). Charges become plain platform charges;
the commission split becomes ledger-only arithmetic rather than something Stripe enforces.

**New schema:**

```
driver_bank_accounts
  driver_id (unique, FK users)
  holder_name          text     -- must match the driver's IC name
  bank_code            text     -- Maybank / CIMB / …
  account_number_enc   text     -- encrypted at rest; PDPA personal data
  last4                text     -- for display, so we never decrypt to render
  verified_at          timestamptz  -- micro-deposit or first successful payout
  created_at / updated_at
```

`payouts` already exists and mostly fits — `stripe_payout_id` becomes a nullable
`provider_reference`, and `method` gains a `duitnow` value.

**New logic:** a balance-owed calculation over `driver_earnings` minus prior payouts (currently the
Connect balance answers this); a payout batch job that selects eligible drivers, writes `pending`
rows, and produces either a bank-portal CSV or provider API calls; a reconciliation step that marks
rows `paid` / `failed` from the bank's response file; a failure path for wrong account numbers.
`canDriverGoOnline` switches from "Connect account active" to "bank details present and verified".

**Two sub-options for the actual transfer:**

- **Manual batch** — export IBG/DuitNow file from Maybank2u Biz or CIMB BizChannel, upload, import
  the response. Zero integration cost, workable for the first cohort, painful past ~100 drivers.
- **Payout API** — Curlec (Razorpay), Fiuu, iPay88, Revenue Monster. Automatable, adds a vendor,
  contract and per-transfer fee.

**Effort:** ~1 week for schema + capture UI + balance + manual batch. Add ~1–2 weeks for a provider
API, excluding their onboarding and contracting.

| | |
|---|---|
| Driver enters | Name, bank, account number. Nothing else |
| Teeko custodies funds | **Yes** — rider money sits with Teeko between trip and payout |
| Fraud / negative balance | **Teeko**, entirely |
| Stripe processing fee | Comes off Teeko's side; driver's net is exactly what the app shows |
| Payout mechanics | Built by us, including retries and failed-transfer handling |
| Compliance surface | Larger. Holding and disbursing third-party funds may engage BNM money-services rules — **needs a lawyer's read, not an engineer's guess**. Bank details are PDPA personal data: encrypt at rest, restrict admin visibility to `last4`, define retention |
| Ongoing ops | Real. Someone runs and reconciles the batch on a schedule |

## 5. Comparison

| | A — Connect + prefill | B — Bank details + DuitNow |
|---|---|---|
| Driver onboarding | Merchant KYC (business questions) | Bank account only |
| Time to build | ~1 day | ~1 week (manual) / ~3 weeks (API) |
| Signup friction | High — the main risk to driver recruitment | Low — matches driver expectations |
| Who holds the money | Stripe / driver | Teeko |
| Who eats fraud | Stripe | Teeko |
| Regulatory exposure | Low | Open question for counsel |
| Instant cashout | Works today | Must be built; depends on rail speed (DuitNow is near-instant, IBG is not) |
| Reversibility | Easy — the rail lives behind `StripeGateway` and `modules/payouts` | Same |

## 6. Recommendation

**Option B, for MVP.** The deciding factor is not cost or engineering time — it is that asking a
driver recruited off Grab to complete Stripe merchant onboarding before their first ride will cost
signups at exactly the moment Teeko can least afford it. "Enter your bank account number" is what a
Malaysian driver expects. Connect's real advantage — never custodying driver money — is worth
paying for at scale, and is worth revisiting once the driver base justifies the friction, or if
counsel flags the custody question as expensive.

Start with the **manual batch**; do not buy a payout API before there are drivers to pay.

Two things to settle before writing code:

1. **Counsel on fund custody.** If holding rider money before disbursement requires a licence Teeko
   doesn't have, that decides this document on its own.
2. **Payout cadence.** Daily, weekly, or on-demand changes the float Teeko carries and whether
   instant cashout is viable at all.

## 7. If Option B is chosen — what happens to the Connect work

The Accounts v2 migration is not wasted. `modules/payouts` keeps its shape; only the rail behind it
changes. `connect_accounts` and the Connect branch of `external/stripe.ts` would be retired (not
deleted — v1.0 may want Connect back at scale), and `payouts.tsx` becomes a bank-details form
instead of a hosted-flow launcher. The rider charge path loses two parameters and nothing else.

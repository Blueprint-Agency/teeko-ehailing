# Teeko — Phone Number Capture & Change Control

> Feature spec + implementation plan. Makes the phone number a **required**
> field at registration in both the rider and driver apps, gates every later
> change behind an **email OTP**, caps changes to **one per 30 days**, and
> routes any change inside that window to an **admin approval queue**.
> Rider numbers may be **any country**; driver numbers are **Malaysia (+60)
> only**.

Related: [Password reset](../tech/teeko-password-reset.md) (the OTP service
this reuses), [Driver PRD](teeko-driver-prd.md), [Rider PRD](teeko-rider-prd.md),
[Admin PRD](teeko-admin-prd.md).

---

## 1. Goal & scope

### Why

Today `users.phone` is optional, unverified, loose-format, and free to change
(rider: instant write; driver: always admin-reviewed). That is not good enough
for three reasons:

1. **Operational contact.** Driver↔rider calling (`tel:` deep link from
   `apps/rider/components/CallChatButtons.tsx`) and support callbacks assume a
   number exists. A NULL phone silently degrades the ride.
2. **APAD/JPJ identity evidence.** A driver's contact number sits on the
   operator record; it must be Malaysian and it must not churn.
3. **Account-takeover surface.** An unguarded phone edit is a quiet way to
   redirect trip contact. An email OTP + a cooldown makes the change
   deliberate and attributable.

### In scope

- Phone required at registration — rider app, driver Expo app, driver web
  portal.
- Rider: **international country-code picker** (full ~240-entry list,
  searchable, defaults to Malaysia).
- Driver: **`+60` fixed**, no picker; non-MY input rejected.
- Email OTP (`purpose: 'phone_change'`) before any phone mutation after
  registration.
- **One phone change per 30 days**, per user, both roles.
- Inside the 30 days: the user may raise an **early-change request** to admin;
  approval writes the number and restarts the clock, rejection costs nothing.
- Driver phone changes stay **always admin-reviewed** (unchanged policy) — the
  30-day rule now governs how often an approval may land, and an in-window
  request is flagged to the reviewer as *early*.
- Backfill: existing accounts with a NULL phone hit a **blocking completion
  screen** at next login.
- Admin: one queue for rider + driver profile-change requests.

### Out of scope

- SMS/WhatsApp OTP to the phone number itself (email OTP only — no MY SMS
  gateway contracted for v0.1).
- Phone-number login / phone as an auth factor. Auth stays email + password
  via Clerk.
- Masked / proxy calling between rider and driver (tracked separately — see
  [deferred](teeko-deferred.md)).
- An admin **force-set** (support typing a number in on the user's behalf mid
  call). The approval queue covers the need for v0.1.
- Any notion of a phone number being unique to one account — see R1.
- Changing the **name** review flow. Driver `full_name` keeps today's
  behaviour verbatim.

---

## 2. Current implementation (what we are changing)

| Area | Today | After |
|---|---|---|
| `users.phone` | `text UNIQUE`, nullable, optional | `text` **without** the unique index, nullable, effectively required (app-enforced), plus `phone_country` + `phone_changed_at` |
| Rider register | Email + password only | Email + password + **phone (any country)** |
| Driver register | Email + password only | Email + password + **phone (+60 locked)** |
| Rider phone edit | Instant PATCH, no verification, no limit | Email OTP → write, max 1 / 30 days, else admin request |
| Driver phone edit | Always admin request; blocked outright inside 30-day cooldown | Email OTP → admin request; in-window request allowed but flagged *early* |
| Uniqueness | `users.phone` is `UNIQUE`; collisions return `phone_taken` | **Dropped** — one person may hold a rider account and a driver account on the same number, exactly as they may on the same email |
| Validation | `/^[+0-9\s\-()]*$/`, max 20 | E.164 + per-role country rule |
| Normalisation | `normalizePhone()` — bare `0…` → `+60…` | Explicit country code from the client; `normalizePhone` keeps the MY shorthand only for the driver path |
| Admin queue | `driver_profile_change_requests`, drivers only | `profile_change_requests`, both roles |

Key files: `apps/backend/src/db/schema/identity.ts:28`,
`apps/backend/src/modules/identity/service.ts:293` (`normalizePhone`),
`apps/backend/src/modules/drivers/profile-changes.ts`,
`apps/backend/src/api/rider/auth.routes.ts`,
`apps/backend/src/api/driver/profile.routes.ts`.

---

## 3. Rules

### R1 — Format

- Stored canonical form is **E.164**: `+` then 8–15 digits, no spaces or
  punctuation.
- The phone number is **not unique**. The `users_phone_unique` index is
  dropped: the same person may hold a rider account and a driver account, and
  those are separate `users` rows sharing a contact number — the same way
  `users.email` already carries no unique constraint. Nothing in the product
  treats a phone number as an identity key.
- `users.phone_country` stores the **ISO-3166 alpha-2** the user picked
  (`'MY'`, `'SG'`, `'GB'`…). Needed because E.164 alone is ambiguous (`+1` is
  US *and* CA) and the picker must round-trip.
- Rider: any country in the dataset. Client sends `{ countryCode: 'SG',
  nationalNumber: '81234567' }`; the server composes and validates.
- Driver: `phone_country` **must** be `'MY'` and the number must match
  `^\+601\d{8,9}$` — **mobile only**. A landline (`+603…`) cannot receive the
  in-trip call a rider places, so it is rejected alongside foreign numbers:
  non-MY → `400 phone_country_not_allowed`, MY landline → `400 phone_invalid`
  with "Enter a Malaysian mobile number".

### R2 — Required at registration

- Registration cannot complete without a valid phone. Client-side validation
  blocks submit; the server rejects a missing/blank phone with
  `400 phone_required`.
- The number is **collected, not verified**, at registration. No OTP at signup.
- `phone_changed_at` is left **NULL** on the initial write, so a user's first
  real change is never blocked by a cooldown they never used.

### R3 — Email OTP on change

- Any mutation of an existing non-NULL phone requires a fresh OTP with
  `purpose: 'phone_change'`, sent to the account's registered email.
- Applies to: rider self-service change, rider early-change request, driver
  change request. Does **not** apply to registration or to the backfill
  completion screen (there is no existing number to protect).
- Reuses `apps/backend/src/modules/auth_otp` — 6-digit code, existing TTL,
  attempt limits and resend throttle. The code is consumed by the mutating
  call, not by a separate verify step, so a verified code cannot be replayed.

### R4 — One change per 30 days

- `PHONE_CHANGE_COOLDOWN_MS = 30 * 24 * 60 * 60 * 1000`.
- The clock is `users.phone_changed_at`, set on **every** successful write to
  `users.phone` — self-service or admin-approved, rider or driver. One clock,
  one rule, both roles.
- A rejected or cancelled request never touches the clock.

### R5 — Inside the window

- Rider self-service PATCH inside the window → `409 phone_cooldown` with
  `nextAllowedAt`; the app offers **"Request an earlier change"**.
- The request carries the new number, a required free-text **reason**, and is
  marked `is_early = true`.
- Driver: every change is a request regardless; inside the window it is simply
  marked `is_early = true` for the reviewer.
- **At most one open (`pending`) phone request per user** — enforced by the
  existing partial unique index. To amend, the user cancels and re-submits.
- Approve → write phone, set `phone_changed_at = now()`, notify. Reject →
  reviewer note required, shown in-app once, no cooldown cost.

### R6 — Legacy NULL phones

- After login, if `users.phone IS NULL`, both apps route to a **blocking**
  "Add your phone number" screen. No skip, no back.
- Same per-role country rules as registration. No OTP. Leaves
  `phone_changed_at` NULL.
- The driver web portal shows the same gate before the dashboard.

---

## 4. User-facing flows

### 4.1 Rider registration

```
Signup form
  Full name · Email · Password
  Phone  [ 🇲🇾 +60 ▾ ] [ 12-345 6789 ]
           └─ tap → searchable country sheet (name / dial code), MY pinned first
  ↓ submit
  invalid format → inline "Enter a valid phone number"
  ok             → account created, phone stored E.164
                   (a number already on another account is fine — not unique)
```

### 4.2 Driver registration (Expo app + web portal)

```
Phone  [ +60 ] [ 12-345 6789 ]
        └─ static prefix, not tappable; helper: "Malaysian mobile numbers only"
Accepts 012…, 12…, +6012… → all normalise to +6012…
Another country code → "Drivers must register a Malaysian (+60) number"
MY landline (+603…)   → "Enter a Malaysian mobile number"
```

### 4.3 Rider phone change (outside cooldown)

```
Account → Personal details → Phone [Change]
  1. New number (+ country picker)         → [Send code]
  2. "We sent a 6-digit code to a***@mail.com"  [______]  Resend in 0:45
  3. [Confirm]  → number updated, "Next change available 10 Oct 2026"
```

### 4.4 Rider phone change (inside cooldown)

```
Step 1 shows a locked state instead:
  "You changed your number on 12 Sep. You can change it again on 12 Oct."
  [Request an earlier change]
     → New number + Reason (required, ≤300 chars) + OTP → submitted
     → Field locks with "In review — submitted 14 Sep"  [Withdraw request]
```

### 4.5 Driver phone change

```
Account → Personal details → Phone
  Always: New number (+60) + OTP → [Submit for review]
  Inside 30 days, an extra notice:
    "You changed your number less than 30 days ago. Tell us why you need
     another change — an admin will review it."  → Reason required
  Field locks while pending; withdraw available. Outcome arrives in the
  notification inbox and as a banner on the screen.
```

### 4.6 Admin review

`apps/admin/app/(panel)/profile-changes` (renamed from the drivers-only view):

| Column | Notes |
|---|---|
| User | Name, role chip (Rider / Driver), link to detail page |
| Field | Full name / Phone |
| Before → After | Snapshot at submission time vs requested |
| Early? | ⚠️ badge + last-changed date when `is_early` |
| Reason | Only present on early requests |
| Actions | Approve · Reject (note required) |

Approval re-validates the format at write time (the per-role country rule may
have tightened since submission) but performs no uniqueness check — phone
numbers are deliberately not unique (R1).

---

## 5. Data model changes

```sql
-- users
-- A number is contact data, not an identity key: one person may hold both a
-- rider and a driver account on the same number, as they already may on the
-- same email (users.email carries no unique constraint either).
DROP INDEX users_phone_unique;                            -- or ALTER TABLE ... DROP CONSTRAINT,
                                                          -- depending on how Drizzle emitted it
ALTER TABLE users ADD COLUMN phone_country text;          -- ISO-3166 alpha-2
ALTER TABLE users ADD COLUMN phone_changed_at timestamptz; -- cooldown clock

-- generalise the driver-only queue to both roles
ALTER TABLE driver_profile_change_requests RENAME TO profile_change_requests;
ALTER TABLE profile_change_requests RENAME COLUMN driver_id TO user_id;
ALTER TABLE profile_change_requests ADD COLUMN is_early boolean NOT NULL DEFAULT false;
ALTER TABLE profile_change_requests ADD COLUMN reason text;
-- indexes renamed to match; the partial unique index on (user_id, field)
-- WHERE status = 'pending' is preserved verbatim.

-- OTP purpose
ALTER TYPE otp_purpose ADD VALUE 'phone_change';  -- or widen the zod enum if
                                                  -- purpose is not a pg enum
```

`phone` itself stays nullable in the DB — legacy rows exist and a NOT NULL
migration would fail. Requiredness is enforced by the API + the R6 gate.

Dropping the unique index also removes the `NULL`-vs-empty-string subtlety
`normalizePhone` was written around, but keep returning `NULL` for a cleared
field regardless: `NULL` means "no number", `''` would pass a `LIKE` filter and
render as a blank contact in the driver-matched card.

Backfill: `UPDATE users SET phone_country = 'MY' WHERE phone LIKE '+60%'` so
existing numbers render correctly in the picker; the rest stay NULL and the
UI falls back to a best-effort dial-code match.

> ⚠️ Migration timestamps: see the repo note on the Drizzle journal
> `folderMillis` pitfall before generating these — a hand-set future timestamp
> silently skips later migrations on staging.

---

## 6. API changes

| Method | Path | Change |
|---|---|---|
| `POST` | `/api/v1/rider/auth/register` (Clerk-side + provisioning) | `phone`, `phoneCountry` now required |
| `POST` | `/api/v1/driver-web/auth/register` | `phone` required, `+60` enforced |
| `PATCH` | `/api/v1/rider/me` | `phone` now requires `phoneCountry` + `otpCode`; new errors `phone_cooldown`, `phone_required`, `otp_invalid` |
| `POST` | `/api/v1/rider/me/phone` | **New** — dedicated phone change (OTP + cooldown), keeps the generic PATCH free of OTP concerns |
| `POST` | `/api/v1/rider/me/phone-change-request` | **New** — early-change request (number + reason + OTP) |
| `GET`/`DELETE` | `/api/v1/rider/me/phone-change-request` | **New** — read state / withdraw |
| `POST` | `/api/v1/driver/profile` | `phone` now requires `otpCode`; in-window submissions accepted with `is_early = true` + `reason` instead of returning `cooldown` |
| `GET` | `/api/v1/driver/profile` | `fields[].nextAllowedAt` unchanged; adds `canRequestEarly` |
| `POST` | `/api/v1/auth/otp/send` | accepts `purpose: 'phone_change'` |
| `GET` | `/api/v1/admin/profile-changes` | renamed from `/admin/driver-profile-changes`; adds `?role=`, returns `isEarly`, `reason`, `role` |
| `POST` | `/api/v1/admin/profile-changes/:id/review` | unchanged semantics; approval sets `phone_changed_at` |

Error vocabulary: `phone_required`, `phone_invalid`,
`phone_country_not_allowed`, `phone_cooldown` (+ `nextAllowedAt`),
`otp_required`, `otp_invalid`, `already_pending`.

---

## 7. Implementation flow

Ordered so each step ships green on its own. Suggested one PR per step.

### Step 1 — Shared phone primitives (`packages/shared`)

- `src/data/countries.ts` — `{ iso2, name, dialCode, flag, example }` for all
  countries, generated once and checked in (no runtime dependency).
- `src/utils/phone.ts`:
  - `toE164(iso2, nationalNumber): string | null`
  - `parseE164(e164, storedIso2?): { iso2, dialCode, nationalNumber }`
  - `isValidPhone(iso2, national)` — length bounds per country; `MY` is
    mobile-only (`+601…`)
  - `formatPhoneDisplay(e164)` — grouping for the UI
  - `MY_ONLY` guard used by the driver paths
- Unit tests for `+60` shorthand (`012…`, `12…`, `+6012…`), `+65`, `+1`, and
  the reject cases — including the MY landline (`+60321…`) rejection.

### Step 2 — Backend schema + service layer

- Drizzle: drop the `users.phone` unique index, add `phone_country`,
  `phone_changed_at`, table rename, `is_early`, `reason`, OTP purpose.
  Generate migration, verify journal ordering.
- `modules/identity/service.ts`: replace the loose `normalizePhone` with the
  shared `toE164`; keep the bare-`0` MY shorthand only behind the driver flag.
- `modules/profile-changes/` (moved from `modules/drivers/profile-changes.ts`):
  role-agnostic `submitProfileChange({ userId, field, value, reason })`,
  `getFieldStates(userId)`, `reviewProfileChange` now stamping
  `users.phone_changed_at` on approval.
- New `modules/identity/phone.ts`: `changePhoneSelfService(userId, e164, iso2,
  otpCode)` — verify OTP → check cooldown → write + stamp. Delete the
  `isUniqueViolation`/`phone_taken` handling from the rider PATCH, the
  `SubmitResult` union in profile-changes, the driver personal screen, and
  the admin approval path.
- `modules/auth_otp`: accept and rate-limit `phone_change`, new email template.

### Step 3 — Backend routes

- Rider: `POST /rider/me/phone`, the request endpoints, and strip `phone` from
  the generic `PATCH /rider/me` (return `400 use_phone_endpoint` if sent).
- Driver: `otpCode` + `reason` on `POST /driver/profile`, allow in-window
  submission.
- Registration paths: require and validate phone per role.
- Admin: rename the route file/mount, add `role` filter, expose `isEarly` +
  `reason`.
- Integration tests: cooldown boundary (day 29 vs day 31), OTP replay,
  concurrent claim of the same number, driver non-MY rejection.

### Step 4 — Shared UI (`packages/ui`)

- `<PhoneInput>` — two variants:
  - `country="picker"` (rider): dial-code button + searchable bottom-sheet
    country list, MY pinned, recents remembered.
  - `country="fixed"` (driver): static `+60` chip, `keyboardType="phone-pad"`.
- `<OtpCodeField>` — reuse whatever the password-reset flow already renders;
  extract if it is currently inlined.

### Step 5 — Rider app

- `app/(auth)/signup.tsx`: required `<PhoneInput country="picker">`.
- `app/(main)/account/personal.tsx`: phone becomes its own row with a
  **Change** action → OTP step → confirm; cooldown state, request state,
  withdraw, and the rejection banner.
- New `app/(main)/account/phone-change-request.tsx` (number + reason + OTP).
- New blocking `app/(onboarding)/add-phone.tsx` + a router guard in
  `app/(main)/_layout.tsx` for `phone === null`.
- i18n keys for all four locales (`en`, `ms`, `zh`, `ta`).

### Step 6 — Driver app + web portal

- `apps/driver/app/(auth)/register.tsx` and
  `apps/web/app/auth/register/page.tsx`: required `+60` phone.
- `apps/driver/app/(driver)/account/personal.tsx`: OTP step before submit;
  in-window path now shows the reason field instead of a hard lock.
- `apps/web/app/profile/page.tsx`: phone stays read-only, but surfaces pending
  / early-request state so the two surfaces agree.
- Blocking add-phone gate in `apps/driver/app/_layout.tsx` and the portal
  layout.

### Step 7 — Admin

- Rename `(panel)/drivers`' profile-change view to `(panel)/profile-changes`,
  add the role chip + filter, the ⚠️ early badge, last-changed date, and the
  reason block. Update `apps/admin/lib/api.ts` endpoints and the sidebar badge
  count.
- Notification inbox copy for rider approve/reject (drivers already have it).

### Step 8 — Backfill & rollout

1. Ship steps 1–3 behind no flag (additive; old clients keep working because
   the generic PATCH still accepts a phone until step 3 lands — sequence the
   PATCH removal *after* the app releases are out).
2. Run the `phone_country` backfill.
3. Release rider + driver apps and the portal together.
4. Watch: registrations completed vs abandoned at the phone step, invalid-format
   rate at the driver `+60` gate, and early-request volume (a spike means the
   30 days is too tight).

---

## 8. Acceptance criteria

- [ ] Neither app can complete registration without a valid phone number.
- [ ] A driver cannot register or request a non-`+60` number or a MY landline,
      in the Expo app or the web portal.
- [ ] A rider can pick any country's dial code; the stored value is E.164 and
      the picker round-trips it on reload.
- [ ] The same number can be registered on a rider account and a driver
      account without error, and `phone_taken` no longer exists anywhere in
      the codebase.
- [ ] No phone mutation succeeds without a valid, unexpired, unused
      `phone_change` OTP (registration and the backfill gate excepted).
- [ ] A rider who changed their number cannot change it again for 30 days;
      the UI states the exact unlock date.
- [ ] An early request is submittable exactly once at a time, requires a
      reason, and is withdrawable.
- [ ] Admin approval writes the number, restarts the 30-day clock, and
      notifies the user; rejection requires a note, shows it in-app, and
      leaves the clock untouched.
- [ ] Every driver phone change still passes through admin review.
- [ ] A legacy account with a NULL phone cannot reach the app's main tabs
      until a number is supplied.

## 9. Decisions log

| # | Question | Decision |
|---|---|---|
| 1 | Verify the phone at registration? | **No** — collected only. Email OTP guards changes, not signup. |
| 2 | Do drivers get the rider's self-service first change? | **No** — every driver phone change stays admin-reviewed. The 30-day rule governs how often an approval may land. |
| 3 | Rider country-code range? | **Full international list**, searchable, MY default. |
| 4 | Legacy NULL phones? | **Blocking completion screen** at next login, both apps + portal. |
| 5 | Release a number for reuse after a change? | **Immediately** — moot once uniqueness is dropped (#7). |
| 6 | Admin force-set a number during a support call? | **Not in v0.1** — the request queue is enough. |
| 7 | Is `users.phone` unique? | **No** — the unique index is dropped. One person may hold a rider *and* a driver account on the same number, exactly as with email. |
| 8 | MY landlines for drivers? | **Rejected** — `+601…` mobile only, because riders dial the number in-trip. |

## 10. Open questions

None outstanding. Raise new ones here as the build turns up edge cases.

---
title: Password Reset — Rider & Driver Apps
status: implemented
date: 2026-08-15
---

# Password Reset — Rider & Driver Apps

## 1. Goal

Let a rider or driver who has forgotten their password recover access without contacting
support, using Clerk's `reset_password_email_code` flow.

Both apps already authenticate against Clerk with **email + password** and an
**`email_code` second factor** (`apps/rider/app/(auth)/login.tsx`,
`apps/driver/app/(auth)/login.tsx`). Password reset is therefore a **client-only**
addition: no new backend routes, no schema change, no change to
`apps/backend/src/http/middleware/auth.ts`, which only verifies the resulting session.

## 2. Non-goals

- SMS/phone-code reset. Both instances verify by email today; adding `phone_code`
  is a Clerk dashboard change plus a strategy branch, not part of this work.
- Password reset for **admin** (`apps/admin`) or the **driver web portal** (`apps/web`).
- Any change to the second-factor policy. Reset does **not** bypass 2FA — see §4.3.

## 3. Prerequisite — Clerk Dashboard

On **both** the rider and driver Clerk instances (they are separate applications):

1. **User & Authentication → Email, Phone, Username → Password** → enable
   *Forgot password*.
2. Set the reset strategy to **email code**, not email link. Magic links are hostile in a
   React Native app — the link opens the system browser, which has no session to hand back
   to the Expo runtime. A 6-digit code keeps the whole flow inside the app.
3. Leave **"Sign out of other active sessions on password reset"** at its default (on).
   For a driver mid-trip this force-logs-out the phone if the reset was done elsewhere,
   which is the correct security posture: a password reset is exactly the moment you want
   other sessions killed. The driver signs back in and
   `api.driver.getActiveTrip()` (wired in `apps/driver/app/_layout.tsx`) restores the trip.

Both the code TTL and the reset attempt rate limit are Clerk-side defaults; we do not
manage them.

## 4. Flow

One screen, three states, per app.

### 4.1 Request

```ts
await signIn.create({
  strategy: 'reset_password_email_code',
  identifier: email.trim(),
});
```

On success, move to the code step. On `form_identifier_not_found` we still move to the
code step and show a neutral message — see §5.

### 4.2 Verify + set new password

Clerk takes the code and the new password in a **single call**:

```ts
const res = await signIn.attemptFirstFactor({
  strategy: 'reset_password_email_code',
  code: code.trim(),
  password: newPassword,
});
```

### 4.3 Complete — and the 2FA branch

`res.status` is **not** always `'complete'`. Because both instances have a second factor
enabled, the common result is `'needs_second_factor'`:

| `res.status` | Action |
|---|---|
| `complete` | `setActive({ session: res.createdSessionId })` → route into the app |
| `needs_second_factor` | `prepareSecondFactor({ strategy })` → OTP step → `attemptSecondFactor` → `setActive` |
| anything else | Surface a generic error and stay put |

The driver app additionally sees `needs_client_trust` on an unrecognised device. Its
existing `prepareClientTrust` helper (`apps/driver/app/(auth)/login.tsx:36`) picks the
first supported factor from `supportedSecondFactors` rather than hardcoding `email_code`;
the reset screen reuses that same approach so a driver enrolled in `phone_code` is not
dead-ended.

Note the password is already changed by the time `needs_second_factor` comes back. The
second factor gates the *session*, not the password write. A user who abandons the flow at
the OTP step has a new password and no session — they can go to Login and use it. The
copy on the OTP step says so.

## 5. Account enumeration

`signIn.create` with an unknown identifier throws `form_identifier_not_found`. Surfacing
that verbatim turns the reset screen into an oracle for "is this email a Teeko user" —
which matters more here than on Login, because reset needs no password to probe.

We therefore **advance to the code step regardless** and show:

> If an account exists for that email, we've sent a 6-digit code.

The subsequent `attemptFirstFactor` fails with `form_code_incorrect` for a
non-existent account, which is indistinguishable from a genuine typo. Login keeps its
existing per-field errors — it is already gated by a password, so it leaks nothing new.

## 6. Error mapping

| Clerk code | Surface |
|---|---|
| `form_identifier_not_found` | *(suppressed — advance to code step, §5)* |
| `form_param_format_invalid` | Inline on email: "Enter a valid email address." |
| `form_code_incorrect`, `verification_failed` | Inline on code: "Incorrect or expired code." |
| `verification_expired` | Inline on code: "Code expired. Tap resend." |
| `form_password_pwned` | Inline on password: "That password has appeared in a data breach." |
| `form_password_length_too_short` | Inline on password: "Use at least 8 characters." |
| `form_password_validation_failed` | Inline on password: generic "Choose a stronger password." |
| `too_many_requests` | Toast/alert: "Too many attempts. Try again shortly." |
| anything else | Generic toast (rider) / `Alert` (driver) |

## 7. SSO accounts

A rider who signed up with Google (`apps/rider/app/sso-callback.tsx`) has **no password**.
Clerk rejects the reset with `form_identifier_not_found`, which §5 deliberately swallows —
so the user reaches the code step and never receives a code. To avoid that dead end, the
rider reset screen keeps the "Continue with Google" affordance visible on the request step
with the hint *"Signed up with Google? Use Google to sign in instead."* The driver app has
no SSO path, so it needs no equivalent.

## 8. Files

| File | Change |
|---|---|
| `apps/rider/app/(auth)/forgot-password.tsx` | New — 3-state reset screen |
| `apps/rider/app/(auth)/_layout.tsx` | Register the `forgot-password` route |
| `apps/rider/app/(auth)/login.tsx` | "Forgot password?" link, carries the typed email |
| `apps/driver/app/(auth)/forgot-password.tsx` | New — same flow, driver styling |
| `apps/driver/app/(auth)/login.tsx` | "Forgot password?" link, carries the typed email |
| `packages/i18n/src/locales/{en,ms,zh,ta}.json` | `auth.forgot*` keys |

The driver app has no `(auth)/_layout.tsx` — its routes are picked up by the root `Stack`
in `apps/driver/app/_layout.tsx`, so adding the file is sufficient.

## 9. Manual test plan

1. Rider, known email, correct code, strong new password → OTP step → lands on `(main)/(tabs)`.
2. Same, but close the app at the OTP step → Login with the **new** password succeeds.
3. Unknown email → code step still shown, no code arrives, wrong-code error on submit.
4. Google-only rider → hint routes them to Google sign-in.
5. Weak password (`password`) → `form_password_pwned` inline error, code not consumed;
   retry with a strong password using the same code succeeds.
6. Driver on a new device → `needs_client_trust` → device-confirm code → home.
7. Wrong code ×5 → `too_many_requests` alert.

## 7. In-app change password (Login & security)

Distinct from §4: the rider is already signed in
(`apps/rider/app/(main)/account/change-password.tsx`) and proves identity with our own
Gmail-SMTP OTP rather than the current password.

Clerk's **client-side** `user.updatePassword()` cannot serve this flow — it requires
`currentPassword` whenever the account has a password set, and newer instances also demand
session reverification. The screen never collects a current password, so every submission
was rejected and surfaced as a generic "Could not update password." toast.

The write therefore happens server-side:

```
POST /api/v1/rider/auth/change-password  { code, newPassword }
```

`changePasswordWithOtp()` (`modules/auth_otp/service.ts`) verifies the OTP and then writes
via the Clerk **admin** API (`riderClerk.users.updateUser`), which takes no current
password. The session token still authenticates the request, so an OTP alone is never
sufficient.

Two details worth keeping:

- The password write runs in `verifyOtp`'s new `onVerified` hook — **before** the code is
  consumed. A password Clerk refuses (pwned/weak) therefore leaves the code usable, so the
  user fixes the password instead of waiting out a 60s resend cooldown.
- `signOutOfOtherSessions` is left **off** here. The admin API has no notion of "current
  session", so enabling it would sign the rider out of the device they are standing on.
  (§3's dashboard setting still applies to the forgot-password flow, which is client-side
  and does know which session is current.)

| Response | Surface |
|---|---|
| `400 incorrect` / `no_active_code` | Inline on code: "Invalid or expired code" |
| `400 expired` | Inline on code: "Code expired — tap resend" |
| `429 too_many_attempts` | Inline on code: "Too many attempts — tap resend" |
| `422 password_rejected` | Inline on password (breach message for `form_password_pwned`) |

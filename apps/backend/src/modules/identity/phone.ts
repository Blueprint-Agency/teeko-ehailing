// modules/identity/phone.ts
// Every write to `users.phone` that is not the initial registration capture.
//
// Three guards, in this order, and the order matters:
//   1. Format — per-role (rider: any country, driver: MY mobile only).
//   2. Cooldown — one change per 30 days, measured on `users.phone_changed_at`.
//   3. OTP — a `phone_change` code sent to the account's registered email.
//
// The OTP is checked last and consumed by the write itself rather than by a
// separate verify step, so a code can never be verified once and replayed at a
// second number. The cooldown is checked before the code is spent, so a user
// inside the window does not burn a code learning they are inside the window.
//
// Note what is *not* here: any uniqueness check. A phone number is contact
// data, not an identity key — see the PRD's R1.

import { and, eq, isNull } from 'drizzle-orm';
// Imported from the subpath, not the '@teeko/shared' barrel, and it has to be:
// the backend is `"type": "module"` while @teeko/shared is not, so its files
// load as CommonJS. Node validates named imports against cjs-module-lexer at
// link time, and the barrel's `export *` re-exports are opaque to it — a static
// import of a value from '@teeko/shared' dies with "does not provide an export
// named ...". The four apps bundle through Metro/webpack and are unaffected,
// which is why this only bites here.
import {
  PHONE_CHANGE_COOLDOWN_MS,
  phoneCooldownEnd,
  resolvePhoneForRole,
  type PhoneError,
} from '@teeko/shared/utils/phone';

import { db } from '../../config/db';
import { users } from '../../db/schema/identity';
import { verifyOtp } from '../auth_otp/service';
import type { ProfileRole } from '../profile-changes';

export type ChangePhoneResult =
  | { status: 'ok'; phone: string; phoneCountry: string; nextAllowedAt: string }
  | { status: 'invalid'; error: PhoneError }
  | { status: 'unchanged' }
  | { status: 'cooldown'; nextAllowedAt: string }
  | { status: 'otp_invalid'; reason: 'no_active_code' | 'expired' | 'too_many_attempts' | 'incorrect' };

/**
 * Rider self-service phone change: OTP → cooldown → write + stamp the clock.
 *
 * Drivers never reach this. Their numbers are identity evidence on the APAD/JPJ
 * operator record, so every driver change stays a request in the review queue
 * (`modules/profile-changes/`) regardless of where they are in the window.
 */
export async function changePhoneSelfService(input: {
  userId: string;
  clerkUserId: string;
  role: ProfileRole;
  countryCode: string;
  nationalNumber: string;
  otpCode: string;
}): Promise<ChangePhoneResult> {
  const resolved = resolvePhoneForRole(input.role, {
    countryCode: input.countryCode,
    nationalNumber: input.nationalNumber,
  });
  if (!resolved.ok) return { status: 'invalid', error: resolved.error };

  const [current] = await db
    .select({
      phone: users.phone,
      phoneCountry: users.phoneCountry,
      phoneChangedAt: users.phoneChangedAt,
    })
    .from(users)
    .where(eq(users.id, input.userId))
    .limit(1);

  if (current?.phone === resolved.e164 && current?.phoneCountry === resolved.iso2) {
    // Nothing to do, and nothing worth spending a code or a month's allowance on.
    return { status: 'unchanged' };
  }

  const end = phoneCooldownEnd(current?.phoneChangedAt ?? null);
  if (end) return { status: 'cooldown', nextAllowedAt: end.toISOString() };

  const verified = await verifyOtp({
    userId: input.userId,
    clerkUserId: input.clerkUserId,
    code: input.otpCode,
    purpose: 'phone_change',
  });
  if (verified.status !== 'verified') return { status: 'otp_invalid', reason: verified.status };

  const now = new Date();
  await db
    .update(users)
    .set({ phone: resolved.e164, phoneCountry: resolved.iso2, phoneChangedAt: now })
    .where(eq(users.id, input.userId));

  return {
    status: 'ok',
    phone: resolved.e164,
    phoneCountry: resolved.iso2,
    nextAllowedAt: new Date(now.getTime() + PHONE_CHANGE_COOLDOWN_MS).toISOString(),
  };
}

export type SetInitialPhoneResult =
  | { status: 'ok'; phone: string; phoneCountry: string }
  | { status: 'invalid'; error: PhoneError }
  | { status: 'already_set'; phone: string };

/**
 * The registration capture and the legacy-NULL completion gate — the only two
 * writes that need no OTP, because there is no existing number to protect.
 *
 * `phone_changed_at` is deliberately left NULL: a user's first real change must
 * never be blocked by a cooldown they never used.
 *
 * Refuses to overwrite an existing number. That is what makes this endpoint
 * safe to leave unauthenticated-by-OTP — it can only ever fill a hole, so it is
 * not a back door around the cooldown or the OTP.
 */
export async function setInitialPhone(input: {
  userId: string;
  role: ProfileRole;
  countryCode: string;
  nationalNumber: string;
}): Promise<SetInitialPhoneResult> {
  const resolved = resolvePhoneForRole(input.role, {
    countryCode: input.countryCode,
    nationalNumber: input.nationalNumber,
  });
  if (!resolved.ok) return { status: 'invalid', error: resolved.error };

  // Conditional on phone IS NULL, so two concurrent submissions cannot both
  // win and the later one cannot silently replace the earlier.
  const written = await db
    .update(users)
    .set({ phone: resolved.e164, phoneCountry: resolved.iso2 })
    .where(and(eq(users.id, input.userId), isNull(users.phone)))
    .returning({ phone: users.phone });

  if (!written.length) {
    const [row] = await db
      .select({ phone: users.phone })
      .from(users)
      .where(eq(users.id, input.userId))
      .limit(1);
    return { status: 'already_set', phone: row?.phone ?? '' };
  }

  return { status: 'ok', phone: resolved.e164, phoneCountry: resolved.iso2 };
}

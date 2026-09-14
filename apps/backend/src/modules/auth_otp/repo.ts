import { and, desc, eq, isNull, sql } from 'drizzle-orm';

import { db } from '../../config/db';
import { otpCodes, users } from '../../db/schema/identity';

export type OtpRow = typeof otpCodes.$inferSelect;

/**
 * What a code may be spent on. Codes are scoped to their purpose: a
 * `phone_change` code proves the user meant to change a phone number and
 * cannot be redirected at a password. Before this existed the column was
 * defaulted and never read, so any live code opened any OTP-guarded door.
 */
export type OtpPurpose = 'email_verification' | 'password_change' | 'phone_change';

export async function insertOtp(input: {
  userId: string;
  email: string;
  codeHash: string;
  expiresAt: Date;
  purpose: OtpPurpose;
}): Promise<void> {
  await db.insert(otpCodes).values({
    userId: input.userId,
    email: input.email,
    codeHash: input.codeHash,
    expiresAt: input.expiresAt,
    purpose: input.purpose,
  });
}

/**
 * Latest UNCONSUMED, UNEXPIRED OTP for a user *and purpose*. Used by verifyOtp
 * to find the candidate code to compare against.
 *
 * Legacy rows written before the column was populated carry the
 * 'email_verification' default, which is what they were — so old codes still
 * verify on the screen that minted them.
 */
export async function findActiveOtp(
  userId: string,
  purpose: OtpPurpose,
): Promise<OtpRow | null> {
  const rows = await db
    .select()
    .from(otpCodes)
    .where(
      and(
        eq(otpCodes.userId, userId),
        eq(otpCodes.purpose, purpose),
        isNull(otpCodes.consumedAt),
      ),
    )
    .orderBy(desc(otpCodes.createdAt))
    .limit(1);
  return rows[0] ?? null;
}

/**
 * Latest OTP regardless of state or purpose. Used to enforce send-side rate
 * limiting (1 send / 60s per user).
 *
 * Deliberately NOT narrowed to a purpose: the throttle is an anti-abuse
 * measure on outbound email, and per-purpose buckets would let a caller send
 * three codes in the time one was meant to take.
 */
export async function findLatestOtp(userId: string): Promise<OtpRow | null> {
  const rows = await db
    .select()
    .from(otpCodes)
    .where(eq(otpCodes.userId, userId))
    .orderBy(desc(otpCodes.createdAt))
    .limit(1);
  return rows[0] ?? null;
}

export async function bumpAttempts(otpId: string): Promise<number> {
  const rows = await db
    .update(otpCodes)
    .set({ attempts: sql`${otpCodes.attempts} + 1` })
    .where(eq(otpCodes.id, otpId))
    .returning({ attempts: otpCodes.attempts });
  return rows[0]?.attempts ?? 0;
}

export async function markConsumed(otpId: string): Promise<void> {
  await db
    .update(otpCodes)
    .set({ consumedAt: new Date() })
    .where(eq(otpCodes.id, otpId));
}

export async function markEmailVerified(userId: string): Promise<void> {
  await db.update(users).set({ emailVerified: true }).where(eq(users.id, userId));
}

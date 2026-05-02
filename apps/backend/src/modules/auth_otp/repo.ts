import { and, desc, eq, isNull, sql } from 'drizzle-orm';

import { db } from '../../config/db';
import { otpCodes, users } from '../../db/schema/identity';

export type OtpRow = typeof otpCodes.$inferSelect;

export async function insertOtp(input: {
  userId: string;
  email: string;
  codeHash: string;
  expiresAt: Date;
}): Promise<void> {
  await db.insert(otpCodes).values({
    userId: input.userId,
    email: input.email,
    codeHash: input.codeHash,
    expiresAt: input.expiresAt,
  });
}

/**
 * Latest UNCONSUMED, UNEXPIRED OTP for a user. Used by verifyOtp to find the
 * candidate code to compare against.
 */
export async function findActiveOtp(userId: string): Promise<OtpRow | null> {
  const rows = await db
    .select()
    .from(otpCodes)
    .where(and(eq(otpCodes.userId, userId), isNull(otpCodes.consumedAt)))
    .orderBy(desc(otpCodes.createdAt))
    .limit(1);
  return rows[0] ?? null;
}

/**
 * Latest OTP regardless of state. Used to enforce send-side rate limiting
 * (1 send / 60s per user).
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

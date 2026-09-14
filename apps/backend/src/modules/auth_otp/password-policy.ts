// modules/auth_otp/password-policy.ts
// One password change per week, per account, for riders and drivers alike.
//
// The clock lives on `users.password_changed_at` rather than in Clerk, because
// the same account can change its password three different ways — the in-app
// OTP screen, the signed-out Clerk reset, and an admin-side Clerk edit — and
// only our own column sees all three. Clerk's `user.updated` webhook back-fills
// it for the paths that never touch our API.

import { eq, sql } from 'drizzle-orm';

import { db } from '../../config/db';
import { users } from '../../db/schema/identity';

export const PASSWORD_CHANGE_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;

export type PasswordCooldown = {
  /** True when the account changed its password inside the last 7 days. */
  blocked: boolean;
  /** ISO instant the next change unlocks; null when the account is free to change now. */
  nextAllowedAt: string | null;
  /** Convenience for HTTP clients that prefer a countdown to a timestamp. */
  retryInSeconds: number;
};

function cooldownFrom(changedAt: Date | null | undefined): PasswordCooldown {
  if (!changedAt) return { blocked: false, nextAllowedAt: null, retryInSeconds: 0 };
  const unlocksAt = changedAt.getTime() + PASSWORD_CHANGE_COOLDOWN_MS;
  const remaining = unlocksAt - Date.now();
  if (remaining <= 0) return { blocked: false, nextAllowedAt: null, retryInSeconds: 0 };
  return {
    blocked: true,
    nextAllowedAt: new Date(unlocksAt).toISOString(),
    retryInSeconds: Math.ceil(remaining / 1000),
  };
}

export async function getPasswordCooldown(userId: string): Promise<PasswordCooldown> {
  const [row] = await db
    .select({ passwordChangedAt: users.passwordChangedAt })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return cooldownFrom(row?.passwordChangedAt);
}

/** Same check for the signed-out reset flow, which only knows an email address. */
export async function getPasswordCooldownByEmail(email: string): Promise<PasswordCooldown | null> {
  const [row] = await db
    .select({ passwordChangedAt: users.passwordChangedAt })
    .from(users)
    .where(sql`lower(${users.email}) = lower(${email}) and ${users.deletedAt} is null`)
    .limit(1);
  // No row: the caller must stay neutral rather than confirm the address exists.
  if (!row) return null;
  return cooldownFrom(row.passwordChangedAt);
}

/**
 * Stamp a successful password change. Never moves the clock backwards — the
 * webhook and the API path both write here and can arrive in either order.
 */
export async function recordPasswordChanged(userId: string, at: Date = new Date()): Promise<void> {
  await db
    .update(users)
    .set({ passwordChangedAt: sql`greatest(${users.passwordChangedAt}, ${at.toISOString()}::timestamptz)` })
    .where(eq(users.id, userId));
}

export async function recordPasswordChangedByEmail(email: string, at: Date = new Date()): Promise<void> {
  await db
    .update(users)
    .set({ passwordChangedAt: sql`greatest(${users.passwordChangedAt}, ${at.toISOString()}::timestamptz)` })
    .where(sql`lower(${users.email}) = lower(${email}) and ${users.deletedAt} is null`);
}

import { createHash, randomInt } from 'node:crypto';

import { logger } from '../../config/logger';
import { clerk } from '../../external/clerk';
import type { ClerkClient } from '@clerk/backend';
import { sendEmail, EmailDeliveryError } from '../../external/gmail-smtp';

import { verificationEmail } from './emails';
import {
  bumpAttempts,
  findActiveOtp,
  findLatestOtp,
  insertOtp,
  markConsumed,
  markEmailVerified,
} from './repo';

const CODE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const RESEND_COOLDOWN_MS = 60 * 1000; // 1 send per 60s
const MAX_ATTEMPTS = 5;

function generateCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, '0');
}

function hashCode(code: string): string {
  return createHash('sha256').update(code).digest('hex');
}

export type SendOtpResult =
  | { status: 'sent' }
  | { status: 'rate_limited'; retryInSeconds: number }
  | { status: 'no_email' }
  | { status: 'delivery_failed'; providerMessage: string; providerStatusCode: number };

export async function sendVerificationOtp(input: {
  userId: string;
  email: string | null;
  fullName: string | null;
}): Promise<SendOtpResult> {
  if (!input.email) return { status: 'no_email' };

  const latest = await findLatestOtp(input.userId);
  if (latest) {
    const ageMs = Date.now() - latest.createdAt.getTime();
    if (ageMs < RESEND_COOLDOWN_MS) {
      return {
        status: 'rate_limited',
        retryInSeconds: Math.ceil((RESEND_COOLDOWN_MS - ageMs) / 1000),
      };
    }
  }

  const code = generateCode();
  const codeHash = hashCode(code);
  const expiresAt = new Date(Date.now() + CODE_TTL_MS);

  await insertOtp({
    userId: input.userId,
    email: input.email,
    codeHash,
    expiresAt,
  });

  const { subject, html } = verificationEmail({ name: input.fullName, code });

  try {
    await sendEmail({ to: input.email, subject, html });
    return { status: 'sent' };
  } catch (err) {
    if (err instanceof EmailDeliveryError) {
      logger.error(
        { userId: input.userId, to: input.email, statusCode: err.statusCode, providerMessage: err.message },
        'OTP email delivery failed — code is in DB but never reached the user',
      );
      return {
        status: 'delivery_failed',
        providerMessage: err.message,
        providerStatusCode: err.statusCode,
      };
    }
    throw err;
  }
}

export type VerifyOtpResult =
  | { status: 'verified' }
  | { status: 'no_active_code' }
  | { status: 'expired' }
  | { status: 'too_many_attempts' }
  | { status: 'incorrect' };

export async function verifyOtp(input: {
  userId: string;
  clerkUserId: string;
  code: string;
  // Which Clerk instance the user lives in. Riders and drivers are separate
  // instances, so the default (rider) would look drivers up in the wrong one.
  clerkClient?: ClerkClient;
  // Runs after the code matches but *before* it is consumed. If it throws, the
  // code stays active so the caller can retry without a resend — used by the
  // change-password flow, where Clerk can still reject the new password.
  onVerified?: () => Promise<void>;
}): Promise<VerifyOtpResult> {
  const active = await findActiveOtp(input.userId);
  if (!active) return { status: 'no_active_code' };

  if (active.expiresAt.getTime() < Date.now()) {
    return { status: 'expired' };
  }
  if (active.attempts >= MAX_ATTEMPTS) {
    return { status: 'too_many_attempts' };
  }

  if (active.codeHash !== hashCode(input.code)) {
    const newAttempts = await bumpAttempts(active.id);
    if (newAttempts >= MAX_ATTEMPTS) {
      return { status: 'too_many_attempts' };
    }
    return { status: 'incorrect' };
  }

  if (input.onVerified) {
    // Deliberately not wrapped: a failure here must propagate to the caller
    // with the code still unconsumed.
    await input.onVerified();
  }

  await markConsumed(active.id);
  await markEmailVerified(input.userId);

  // Best-effort: also mark Clerk's email verified so any other Clerk-side
  // gates pass. Failure here doesn't block our own verified status — our
  // users.email_verified column is the source of truth.
  try {
    const clerkClient = input.clerkClient ?? clerk;
    const user = await clerkClient.users.getUser(input.clerkUserId);
    const primary = user.emailAddresses.find(
      (e) => e.id === user.primaryEmailAddressId,
    );
    if (primary && primary.verification?.status !== 'verified') {
      // TODO: Clerk admin SDK does not expose a stable "force-mark email
      // verified" call across all versions. Left as a no-op intentionally.
    }
  } catch (err) {
    logger.warn({ err, clerkUserId: input.clerkUserId }, 'clerk email verification sync failed');
  }

  return { status: 'verified' };
}

export type ChangePasswordResult =
  | { status: 'ok' }
  | Exclude<VerifyOtpResult, { status: 'verified' }>
  | { status: 'password_rejected'; code: string; message: string };

/** Clerk backend errors carry `errors: [{ code, message, longMessage }]`. */
function clerkErrorDetail(err: unknown): { code: string; message: string } | null {
  const errors = (err as { errors?: Array<{ code?: string; message?: string; longMessage?: string }> })
    .errors;
  const first = Array.isArray(errors) ? errors[0] : undefined;
  if (!first?.code) return null;
  return { code: first.code, message: first.longMessage ?? first.message ?? 'Password rejected' };
}

/**
 * Change the account password after proving identity with an email OTP.
 *
 * The password is written with the Clerk **admin** API, which — unlike the
 * client-side `user.updatePassword` — does not demand the current password.
 * The OTP is what proves identity here; requiring the old password too would
 * defeat the point of the screen. The session token still authenticates the
 * request, so an OTP alone is never sufficient.
 */
export async function changePasswordWithOtp(input: {
  userId: string;
  clerkUserId: string;
  code: string;
  newPassword: string;
  clerkClient?: ClerkClient;
}): Promise<ChangePasswordResult> {
  const clerkClient = input.clerkClient ?? clerk;
  const rejected: Array<{ code: string; message: string }> = [];

  let result: VerifyOtpResult;
  try {
    result = await verifyOtp({
      userId: input.userId,
      clerkUserId: input.clerkUserId,
      code: input.code,
      clerkClient,
      onVerified: async () => {
        try {
          await clerkClient.users.updateUser(input.clerkUserId, {
            password: input.newPassword,
            // Deliberately NOT signing out other sessions: the admin API has no
            // notion of "current", so it would sign the user out of the very
            // device they are changing the password on.
            signOutOfOtherSessions: false,
          });
        } catch (err) {
          const detail = clerkErrorDetail(err);
          if (detail) {
            // A weak/pwned password is the user's problem to fix, not an outage.
            // Record it and rethrow so the OTP survives for the retry.
            rejected.push(detail);
          } else {
            logger.error({ err, clerkUserId: input.clerkUserId }, 'clerk password update failed');
          }
          throw err;
        }
      },
    });
  } catch (err) {
    const detail = rejected[0];
    if (!detail) throw err;
    return { status: 'password_rejected', code: detail.code, message: detail.message };
  }

  if (result.status === 'verified') return { status: 'ok' };
  return result;
}

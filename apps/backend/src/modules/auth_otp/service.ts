import { createHash, randomInt } from 'node:crypto';

import { logger } from '../../config/logger';
import { clerk } from '../../external/clerk';
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

  await markConsumed(active.id);
  await markEmailVerified(input.userId);

  // Best-effort: also mark Clerk's email verified so any other Clerk-side
  // gates pass. Failure here doesn't block our own verified status — our
  // users.email_verified column is the source of truth.
  try {
    const user = await clerk.users.getUser(input.clerkUserId);
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

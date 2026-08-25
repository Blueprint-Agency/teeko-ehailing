// client/auth.ts
// Wraps GET /api/v1/rider/auth/me, PATCH /me, POST /send-otp, POST /verify-otp.
import type { Locale, Rider } from '@teeko/shared';

import { api, resolveMediaUrl } from './_fetch';

type RiderMeResponse = {
  user: {
    id: string;
    email: string | null;
    emailVerified: boolean;
    fullName: string | null;
    avatarUrl: string | null;
    phone: string | null;
    locale: Locale;
    status: 'active' | 'suspended' | 'deactivated';
  };
  riderProfile: {
    ratingAvg: number | null;
    ratingCount: number | null;
  };
};

function toRider(res: RiderMeResponse): Rider {
  return {
    id: res.user.id,
    name: res.user.fullName ?? '',
    phone: res.user.phone ?? '',
    email: res.user.email ?? undefined,
    avatarUrl: resolveMediaUrl(res.user.avatarUrl),
    rating: res.riderProfile.ratingAvg ?? 0,
    languagePref: res.user.locale,
    verified: res.user.emailVerified,
    signupDate: undefined,
  };
}

export async function getMe(): Promise<Rider> {
  const res = await api<RiderMeResponse>('/api/v1/rider/auth/me');
  return toRider(res);
}

export async function updateMe(patch: {
  fullName?: string;
  /** Any human format; the server normalises before storing. '' clears it. */
  phone?: string;
  locale?: Locale;
}): Promise<void> {
  await api<{ ok: true }>('/api/v1/rider/auth/me', {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
}

/**
 * Upload a new profile picture. `uri` is whatever the image picker handed back
 * (a `file://` path on device); React Native's FormData takes that shape
 * directly and streams the file, so nothing is ever read into JS memory.
 *
 * Returns the absolute URL of the stored image, ready to render.
 */
export async function uploadAvatar(file: {
  uri: string;
  name?: string;
  mimeType?: string;
}): Promise<string> {
  const form = new FormData();
  form.append('file', {
    uri: file.uri,
    name: file.name ?? 'avatar.jpg',
    type: file.mimeType ?? 'image/jpeg',
  } as unknown as Blob);
  const res = await api<{ avatarUrl: string }>('/api/v1/rider/auth/me/avatar', {
    method: 'POST',
    body: form,
  });
  // Non-null: the server only answers 200 with a stored path.
  return resolveMediaUrl(res.avatarUrl)!;
}

/** Remove the current profile picture and fall back to the initials avatar. */
export async function removeAvatar(): Promise<void> {
  await api<{ avatarUrl: null }>('/api/v1/rider/auth/me/avatar', { method: 'DELETE' });
}

/**
 * `purpose: 'password_change'` makes the server apply the one-change-per-week
 * rule *before* emailing a code, so the rider never types a code that was never
 * going to be spendable. It answers 429 `password_change_cooldown` with a
 * `nextAllowedAt`. Plain email verification passes no purpose and is never gated.
 */
export async function sendOtp(
  purpose?: 'email_verification' | 'password_change',
): Promise<void> {
  await api<{ ok: true }>('/api/v1/rider/auth/send-otp', {
    method: 'POST',
    body: JSON.stringify(purpose ? { purpose } : {}),
  });
}

export type PasswordResetEligibility = {
  allowed: boolean;
  /** ISO instant the next reset unlocks; null when a reset is allowed now. */
  nextAllowedAt: string | null;
  retryInSeconds: number;
};

/**
 * Signed-out "forgot password" runs against Clerk from the device, so the
 * one-reset-per-week rule has to be asked for before Clerk emails a code.
 * An unknown address always answers `allowed`, so this can never be used to
 * probe whether someone holds a Teeko account.
 */
export async function checkPasswordResetEligibility(
  email: string,
): Promise<PasswordResetEligibility> {
  return api<PasswordResetEligibility>('/api/public/password-reset/eligibility', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

/** Call once Clerk has accepted the new password — starts the 7-day clock. */
export async function recordPasswordReset(email: string): Promise<void> {
  await api<{ ok: true }>('/api/public/password-reset/record', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

export async function verifyOtp(code: string): Promise<{ ok: true }> {
  return api<{ ok: true }>('/api/v1/rider/auth/verify-otp', {
    method: 'POST',
    body: JSON.stringify({ code }),
  });
}

/**
 * Verifies the OTP and applies the new password in one call. Server-side,
 * because Clerk's client SDK requires the current password and this flow
 * proves identity with the emailed code instead.
 */
export async function changePassword(code: string, newPassword: string): Promise<{ ok: true }> {
  return api<{ ok: true }>('/api/v1/rider/auth/change-password', {
    method: 'POST',
    body: JSON.stringify({ code, newPassword }),
  });
}

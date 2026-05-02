// client/auth.ts
// Wraps GET /api/v1/rider/auth/me, PATCH /me, POST /send-otp, POST /verify-otp.
import type { Locale, Rider } from '@teeko/shared';

import { api } from './_fetch';

type RiderMeResponse = {
  user: {
    id: string;
    email: string | null;
    emailVerified: boolean;
    fullName: string | null;
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
    phone: '', // not collected this phase
    email: res.user.email ?? undefined,
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

export async function updateMe(patch: { fullName?: string; locale?: Locale }): Promise<void> {
  await api<{ ok: true }>('/api/v1/rider/auth/me', {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
}

export async function sendOtp(): Promise<void> {
  await api<{ ok: true }>('/api/v1/rider/auth/send-otp', {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export async function verifyOtp(code: string): Promise<{ ok: true }> {
  return api<{ ok: true }>('/api/v1/rider/auth/verify-otp', {
    method: 'POST',
    body: JSON.stringify({ code }),
  });
}

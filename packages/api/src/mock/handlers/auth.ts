import type { Rider } from '@teeko/shared';

import { simulateLatency } from '../delay';
import ridersJson from '../data/riders.json';

const riders = ridersJson as Rider[];

export type OtpChallenge = { phone: string; challengeId: string };

export const OTP_INVALID = 'OTP_INVALID' as const;

export async function sendOtp(phone: string): Promise<OtpChallenge> {
  await simulateLatency();
  return { phone, challengeId: `otp_${Date.now()}` };
}

// Plan §3: any code starting with '1' succeeds (demo affordance); anything else throws OTP_INVALID.
export async function verifyOtp(_challengeId: string, code: string): Promise<Rider> {
  await simulateLatency();
  if (!/^1\d{5}$/.test(code)) {
    const err = new Error('OTP_INVALID');
    err.name = OTP_INVALID;
    throw err;
  }
  return riders[0]!;
}

export async function me(): Promise<Rider | null> {
  await simulateLatency(200, 500);
  return null;
}

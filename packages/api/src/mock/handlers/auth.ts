import type { Rider } from '@teeko/shared';

import { simulateLatency } from '../delay';
import ridersJson from '../data/riders.json';

const riders = ridersJson as Rider[];

export const EMAIL_INVALID = 'EMAIL_INVALID' as const;
export const PASSWORD_INVALID = 'PASSWORD_INVALID' as const;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type SignupResult = {
  email: string;
  verifyToken: string;
};

// Demo rule: any syntactically valid email + any non-empty password succeeds.
export async function signInWithEmail(email: string, password: string): Promise<Rider> {
  await simulateLatency();
  if (!EMAIL_RE.test(email)) {
    const err = new Error('EMAIL_INVALID');
    err.name = EMAIL_INVALID;
    throw err;
  }
  if (!password) {
    const err = new Error('PASSWORD_INVALID');
    err.name = PASSWORD_INVALID;
    throw err;
  }
  const base = riders[0]!;
  return {
    ...base,
    email,
    verified: true,
    signupDate: base.signupDate ?? new Date().toISOString(),
  };
}

// Signup starts verification — rider is not returned until verifyEmail completes.
export async function signUpWithEmail(
  _name: string,
  email: string,
  password: string,
): Promise<SignupResult> {
  await simulateLatency();
  if (!EMAIL_RE.test(email)) {
    const err = new Error('EMAIL_INVALID');
    err.name = EMAIL_INVALID;
    throw err;
  }
  if (!password) {
    const err = new Error('PASSWORD_INVALID');
    err.name = PASSWORD_INVALID;
    throw err;
  }
  return { email, verifyToken: `verify_${Date.now()}` };
}

// Google sign-in skips verification — returns authed rider immediately.
export async function signInWithGoogle(): Promise<Rider> {
  await simulateLatency(500, 900);
  const base = riders[0]!;
  return {
    ...base,
    email: base.email ?? 'demo.user@gmail.com',
    verified: true,
    signupDate: base.signupDate ?? new Date().toISOString(),
  };
}

// Verification step after signup — always succeeds in the mockup.
export async function verifyEmail(
  _token: string,
  name: string,
  email: string,
): Promise<Rider> {
  await simulateLatency(700, 1200);
  const base = riders[0]!;
  return {
    ...base,
    name: name || base.name,
    email,
    verified: true,
    signupDate: new Date().toISOString(),
  };
}

export async function resendVerification(_token: string): Promise<void> {
  await simulateLatency(400, 700);
}

export async function me(): Promise<Rider | null> {
  await simulateLatency(200, 500);
  return null;
}

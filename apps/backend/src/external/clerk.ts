// External provider clients — Clerk (separate instances for rider and driver apps).
// Wraps @clerk/backend so middleware/webhook code never touches the SDK directly.
import { createClerkClient, verifyToken, type ClerkClient } from '@clerk/backend';

import { env } from '../config/env';

export const riderClerk: ClerkClient = createClerkClient({
  secretKey: env.CLERK_RIDER_SECRET_KEY,
  publishableKey: env.CLERK_RIDER_PUBLISHABLE_KEY,
});

export const driverClerk: ClerkClient = createClerkClient({
  secretKey: env.CLERK_DRIVER_SECRET_KEY,
  publishableKey: env.CLERK_DRIVER_PUBLISHABLE_KEY,
});

// Backward-compat alias used by modules/auth_otp and modules/identity (rider path).
export const clerk: ClerkClient = riderClerk;

export type ClerkClaims = {
  sub: string;
  email?: string;
  // Present only if the Clerk JWT template exposes `email_verified`. Undefined
  // means "unknown from the token" — the caller falls back to the admin API.
  emailVerified?: boolean;
  firstName?: string;
  lastName?: string;
};

function extractClaims(verified: {
  sub: string;
  email?: unknown;
  email_verified?: unknown;
  first_name?: unknown;
  last_name?: unknown;
}): ClerkClaims {
  return {
    sub: verified.sub,
    email: typeof verified.email === 'string' ? verified.email : undefined,
    emailVerified: typeof verified.email_verified === 'boolean' ? verified.email_verified : undefined,
    firstName: typeof verified.first_name === 'string' ? verified.first_name : undefined,
    lastName: typeof verified.last_name === 'string' ? verified.last_name : undefined,
  };
}

export async function verifyRiderClerkToken(token: string): Promise<ClerkClaims> {
  const verified = await verifyToken(token, { secretKey: env.CLERK_RIDER_SECRET_KEY });
  return extractClaims(verified);
}

export async function verifyDriverClerkToken(token: string): Promise<ClerkClaims> {
  const verified = await verifyToken(token, { secretKey: env.CLERK_DRIVER_SECRET_KEY });
  return extractClaims(verified);
}

// Backward-compat alias — resolves to the rider verifier.
export const verifyClerkToken = verifyRiderClerkToken;

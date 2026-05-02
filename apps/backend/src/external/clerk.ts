// External provider client — Clerk.
// Wraps @clerk/backend so middleware/webhook code never touches the SDK directly.
import { createClerkClient, verifyToken, type ClerkClient } from '@clerk/backend';

import { env } from '../config/env';

export const clerk: ClerkClient = createClerkClient({
  secretKey: env.CLERK_SECRET_KEY,
  publishableKey: env.CLERK_PUBLISHABLE_KEY,
});

export type ClerkClaims = {
  sub: string;
  email?: string;
  firstName?: string;
  lastName?: string;
};

/**
 * Verify a Clerk-issued JWT bearer token.
 * Throws if the token is missing, malformed, expired, or fails signature checks.
 * Returns the verified claims we care about.
 */
export async function verifyClerkToken(token: string): Promise<ClerkClaims> {
  const verified = await verifyToken(token, {
    secretKey: env.CLERK_SECRET_KEY,
  });
  return {
    sub: verified.sub,
    email: typeof verified.email === 'string' ? verified.email : undefined,
    firstName: typeof verified.first_name === 'string' ? verified.first_name : undefined,
    lastName: typeof verified.last_name === 'string' ? verified.last_name : undefined,
  };
}

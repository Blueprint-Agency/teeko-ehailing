// modules/identity/service.ts
// Identity domain orchestration. Routes call into this service; repo stays
// private to the module.
import { logger } from '../../config/logger';
import { isUniqueViolation } from '../../db/errors';
import { clerk, type ClerkClaims } from '../../external/clerk';

import {
  findUserByExternalId,
  provisionRider,
  updateRiderFields,
  softDeleteUser,
  getRiderProfileBundle,
  type IdentityRow,
} from './repo';

export type RiderMeResponse = {
  user: {
    id: string;
    email: string | null;
    fullName: string | null;
    locale: 'en' | 'ms' | 'zh' | 'ta';
    status: 'active' | 'suspended' | 'deactivated';
  };
  riderProfile: {
    ratingAvg: number | null;
    ratingCount: number | null;
  };
};

/**
 * Resolve the user's email + name. Prefer JWT claims (cheap), but if the
 * Clerk JWT template isn't configured to include email/first_name/last_name,
 * fall back to a one-time Clerk admin API call to fetch them by user id.
 *
 * Used only inside JIT (first signup). Subsequent /me calls hit the row directly.
 */
async function resolveProfileFromClerk(
  claims: ClerkClaims,
): Promise<{ email: string | undefined; fullName: string | undefined }> {
  const claimEmail = claims.email;
  const claimName = [claims.firstName, claims.lastName].filter(Boolean).join(' ').trim();
  if (claimEmail) {
    return { email: claimEmail, fullName: claimName || undefined };
  }
  // Fallback: JWT template missing fields; query Clerk admin API.
  try {
    const user = await clerk.users.getUser(claims.sub);
    const primaryEmail = user.emailAddresses.find(
      (e) => e.id === user.primaryEmailAddressId,
    )?.emailAddress;
    const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
    return {
      email: primaryEmail ?? undefined,
      fullName: fullName || undefined,
    };
  } catch (err) {
    logger.warn(
      { clerkUserId: claims.sub, err },
      'clerk admin lookup failed during JIT — provisioning with empty profile',
    );
    return { email: claimEmail, fullName: claimName || undefined };
  }
}

/**
 * Get-or-create the rider's row. Used by GET /me.
 * Returns the full bundle. Idempotent.
 */
export async function getOrProvisionRiderMe(claims: ClerkClaims): Promise<RiderMeResponse> {
  if (!claims.sub) {
    throw new Error('clerk claims missing sub');
  }
  let row: IdentityRow | null = await findUserByExternalId('clerk', claims.sub);
  if (!row) {
    const profile = await resolveProfileFromClerk(claims);
    try {
      await provisionRider({
        clerkUserId: claims.sub,
        email: profile.email,
        fullName: profile.fullName,
      });
    } catch (err) {
      // Concurrent first-/me race: another request just provisioned the same
      // Clerk user. Loser of the race re-reads the row that the winner created.
      if (!isUniqueViolation(err)) throw err;
      logger.debug({ clerkUserId: claims.sub }, 'JIT race lost, re-reading existing row');
    }
    row = await findUserByExternalId('clerk', claims.sub);
    if (!row) throw new Error('provisionRider succeeded but row not found');
  }
  const bundle = await getRiderProfileBundle(row.id);
  if (!bundle) throw new Error('user row exists but profile bundle missing');
  return {
    user: {
      id: bundle.id,
      email: bundle.email,
      fullName: bundle.fullName,
      locale: bundle.locale,
      status: bundle.status,
    },
    riderProfile: {
      ratingAvg: bundle.ratingAvg !== null ? Number(bundle.ratingAvg) : null,
      ratingCount: bundle.ratingCount,
    },
  };
}

export type RiderMePatch = {
  fullName?: string;
  locale?: 'en' | 'ms' | 'zh' | 'ta';
};

export async function patchRiderMe(userId: string, patch: RiderMePatch): Promise<void> {
  await updateRiderFields(userId, patch);
}

/**
 * Sync handler for Clerk `user.updated` and `user.deleted` webhooks.
 */
export async function applyClerkWebhook(event: {
  type: 'user.updated' | 'user.deleted';
  clerkUserId: string;
  email?: string | null;
  fullName?: string | null;
}): Promise<void> {
  const row = await findUserByExternalId('clerk', event.clerkUserId);
  if (!row) return; // never provisioned on our side; ignore

  if (event.type === 'user.deleted') {
    await softDeleteUser(row.id);
    return;
  }
  await updateRiderFields(row.id, {
    email: event.email ?? null,
    fullName: event.fullName ?? undefined,
  });
}

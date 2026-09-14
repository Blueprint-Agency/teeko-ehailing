// modules/identity/service.ts
// Identity domain orchestration. Routes call into this service; repo stays
// private to the module.
import { logger } from '../../config/logger';
import { isUniqueViolation } from '../../db/errors';
import { clerk, driverClerk, type ClerkClaims } from '../../external/clerk';
import { recordPasswordChanged } from '../auth_otp/password-policy';
import { sendVerificationOtp } from '../auth_otp/service';

import {
  findUserByExternalId,
  provisionRider,
  provisionDriver,
  updateRiderFields,
  softDeleteUser,
  findLiveUserByEmail,
  getRiderProfileBundle,
  recordPdpaConsent,
  type IdentityRow,
} from './repo';

export type RiderMeResponse = {
  user: {
    id: string;
    email: string | null;
    emailVerified: boolean;
    fullName: string | null;
    /** Relative `/uploads/...` path or absolute URL; null when never uploaded. */
    avatarUrl: string | null;
    /** E.164, or null on a legacy row — which routes the app to the add-phone gate. */
    phone: string | null;
    /** ISO-3166 alpha-2 the picker round-trips from. Null on un-backfilled rows. */
    phoneCountry: string | null;
    /** Null means the number has never changed, so the next change is free. */
    phoneChangedAt: string | null;
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
  clerkClient = clerk,
): Promise<{ email: string | undefined; fullName: string | undefined; emailVerified: boolean }> {
  const claimEmail = claims.email;
  const claimName = [claims.firstName, claims.lastName].filter(Boolean).join(' ').trim();
  // Fast path: only when the JWT template exposes BOTH email and email_verified
  // can we skip the admin call. If email_verified is absent we must query Clerk
  // to learn the true verification status (e.g. Google OAuth = already verified).
  if (claimEmail && claims.emailVerified !== undefined) {
    return { email: claimEmail, fullName: claimName || undefined, emailVerified: claims.emailVerified };
  }
  // Fallback: query Clerk admin API for the missing field(s) + verification status.
  try {
    const user = await clerkClient.users.getUser(claims.sub);
    const primary = user.emailAddresses.find((e) => e.id === user.primaryEmailAddressId);
    const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
    return {
      email: primary?.emailAddress ?? claimEmail ?? undefined,
      fullName: fullName || claimName || undefined,
      emailVerified: primary?.verification?.status === 'verified',
    };
  } catch (err) {
    logger.warn(
      { clerkUserId: claims.sub, err },
      'clerk admin lookup failed during JIT — provisioning with empty profile',
    );
    return { email: claimEmail, fullName: claimName || undefined, emailVerified: claims.emailVerified ?? false };
  }
}

// Clerk's `sub` is the only key that can legitimately collide during JIT
// provisioning: two first-/me calls for the same user racing each other.
const CLERK_SUB_UNIQUE = 'external_identities_providerSub_unique';
// Partial unique index from migration 0017: lower(email) WHERE deleted_at IS NULL.
const EMAIL_UNIQUE = 'users_email_lower_unique_idx';

/** True when the Clerk instance no longer knows `clerkUserId` (404). */
async function clerkUserIsGone(clerkClient: typeof clerk, clerkUserId: string): Promise<boolean> {
  try {
    await clerkClient.users.getUser(clerkUserId);
    return false;
  } catch (err) {
    const status = (err as { status?: unknown }).status;
    if (status === 404) return true;
    // Network / auth failure: we cannot prove the account is gone, so treat it
    // as live and let the collision surface rather than steal an email.
    logger.warn({ clerkUserId, err }, 'clerk lookup failed while checking a stale email holder');
    return false;
  }
}

/**
 * Run `provision`. Returns true when this request created the row, false when
 * a concurrent request beat us to it (the caller re-reads).
 *
 * An email collision gets one self-heal attempt: if the row holding the email
 * belongs to a Clerk user that has since been deleted (the `user.deleted`
 * webhook never reached us — local dev, or it was deleted before the webhook
 * existed), that row is soft-deleted, which releases the partial index, and
 * provisioning is retried once. Clerk verified the email at sign-up, so the
 * new user has proven ownership.
 *
 * Any other failure is rethrown with the PG details logged, so a broken row
 * never masquerades as a lost race and then surfaces as a "row not found" 500
 * with no evidence.
 */
async function provisionOnce(
  role: 'rider' | 'driver',
  clerkUserId: string,
  email: string | undefined,
  clerkClient: typeof clerk,
  provision: () => Promise<string>,
): Promise<boolean> {
  for (let attempt = 0; ; attempt++) {
    try {
      await provision();
      return true;
    } catch (err) {
      if (isUniqueViolation(err, CLERK_SUB_UNIQUE)) {
        logger.debug({ clerkUserId, role }, 'JIT race lost, re-reading existing row');
        return false;
      }
      if (attempt === 0 && email && isUniqueViolation(err, EMAIL_UNIQUE)) {
        const holder = await findLiveUserByEmail(email);
        // Same role only: rider and driver live in different Clerk instances,
        // so a rider's sub is always "gone" from the driver instance and vice
        // versa — never soft-delete the other app's account.
        if (
          holder?.clerkUserId &&
          holder.role === role &&
          (await clerkUserIsGone(clerkClient, holder.clerkUserId))
        ) {
          logger.info(
            { clerkUserId, role, staleUserId: holder.id, staleClerkUserId: holder.clerkUserId },
            'JIT: email held by a deleted Clerk user — soft-deleting stale row and retrying',
          );
          await softDeleteUser(holder.id);
          continue;
        }
      }
      const e = err as { code?: unknown; constraint_name?: unknown; detail?: unknown };
      logger.error(
        { clerkUserId, role, code: e.code, constraint: e.constraint_name, detail: e.detail, err },
        'JIT provisioning failed',
      );
      throw err;
    }
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
  let weCreatedTheRow = false;
  let provisionedProfile:
    | { email: string | undefined; fullName: string | undefined; emailVerified: boolean }
    | null = null;
  if (!row) {
    const profile = await resolveProfileFromClerk(claims);
    provisionedProfile = profile;
    const clerkUserId = claims.sub;
    // Concurrent first-/me race: another request may have just provisioned the
    // same Clerk user. The loser re-reads the row the winner created.
    weCreatedTheRow = await provisionOnce('rider', clerkUserId, profile.email, clerk, () =>
      provisionRider({
        clerkUserId,
        email: profile.email,
        fullName: profile.fullName,
        emailVerified: profile.emailVerified,
      }),
    );
    row = await findUserByExternalId('clerk', clerkUserId);
    if (!row) {
      // The identity row exists (the insert collided on it) but the join in
      // findUserByExternalId dropped it — almost always a missing user_roles
      // row from a half-migrated or hand-edited account.
      throw new Error(
        `rider JIT: external identity exists for ${clerkUserId} but no joinable user row`,
      );
    }
  }
  const bundle = await getRiderProfileBundle(row.id);
  if (!bundle) throw new Error('user row exists but profile bundle missing');

  // Auto-fire the first verification OTP only when WE just created the row,
  // we have an email, AND Clerk hasn't already verified it. OAuth signups
  // (e.g. Google) arrive pre-verified and skip the OTP entirely.
  // Fire-and-forget; failures are logged.
  if (weCreatedTheRow && provisionedProfile?.email && !provisionedProfile.emailVerified) {
    const userId = row.id;
    const email = provisionedProfile.email;
    const fullName = provisionedProfile.fullName ?? null;
    void (async () => {
      try {
        await sendVerificationOtp({ userId, email, fullName });
      } catch (err) {
        logger.warn({ err, userId }, 'auto-send OTP failed');
      }
    })();
  }

  return {
    user: {
      id: bundle.id,
      email: bundle.email,
      emailVerified: bundle.emailVerified,
      fullName: bundle.fullName,
      avatarUrl: bundle.avatarUrl,
      phone: bundle.phone,
      phoneCountry: bundle.phoneCountry,
      phoneChangedAt: bundle.phoneChangedAt?.toISOString() ?? null,
      locale: bundle.locale,
      status: bundle.status,
    },
    riderProfile: {
      ratingAvg: bundle.ratingAvg !== null ? Number(bundle.ratingAvg) : null,
      ratingCount: bundle.ratingCount,
    },
  };
}

export type DriverMeResponse = {
  user: {
    id: string;
    email: string | null;
    emailVerified: boolean;
    fullName: string | null;
    /** Relative `/uploads/...` path or absolute URL; null when never uploaded. */
    avatarUrl: string | null;
    /** E.164 '+60…'; null on a legacy row, which routes to the add-phone gate. */
    phone: string | null;
    /** Always 'MY' for a driver once set — the column exists for the shared shape. */
    phoneCountry: string | null;
    /** Null means never changed, so the next request is not flagged early. */
    phoneChangedAt: string | null;
    status: 'active' | 'suspended' | 'deactivated';
    pdpaConsentAt: string | null;
  };
  driverProfile: {
    approvalStatus: string;
  };
  // Drives post-login routing in BOTH the web portal and the Expo driver app:
  // onboarding wizard → pending → resubmission → dashboard.
  application: {
    state: string;
    rejectionReason: string | null;
    submittedAt: string | null;
  } | null;
};

/**
 * Get-or-create the driver's row. Used by GET /auth/me on both the driver API
 * (Expo) and the driver-web API (portal) — whichever app the driver reaches
 * first provisions; the other reads. Idempotent, safe on every app launch.
 */
export async function getOrProvisionDriverMe(claims: ClerkClaims): Promise<DriverMeResponse> {
  if (!claims.sub) throw new Error('clerk claims missing sub');

  let row: IdentityRow | null = await findUserByExternalId('clerk', claims.sub);
  let weCreatedTheRow = false;
  let provisionedProfile:
    | { email: string | undefined; fullName: string | undefined; emailVerified: boolean }
    | null = null;
  if (!row) {
    const profile = await resolveProfileFromClerk(claims, driverClerk);
    provisionedProfile = profile;
    const clerkUserId = claims.sub;
    weCreatedTheRow = await provisionOnce('driver', clerkUserId, profile.email, driverClerk, () =>
      provisionDriver({
        clerkUserId,
        email: profile.email,
        fullName: profile.fullName,
        emailVerified: profile.emailVerified,
      }),
    );
    row = await findUserByExternalId('clerk', clerkUserId);
    if (!row) {
      throw new Error(
        `driver JIT: external identity exists for ${clerkUserId} but no joinable user row`,
      );
    }
  }

  const { db } = await import('../../config/db');
  const { driverProfiles } = await import('../../db/schema/drivers');
  const { driverApplications } = await import('../../db/schema/onboarding');
  const { users } = await import('../../db/schema/identity');
  const { eq } = await import('drizzle-orm');

  const [dp] = await db
    .select({ approvalStatus: driverProfiles.approvalStatus })
    .from(driverProfiles)
    .where(eq(driverProfiles.userId, row.id))
    .limit(1);

  const [application] = await db
    .select({
      state: driverApplications.state,
      rejectionReason: driverApplications.rejectionReason,
      submittedAt: driverApplications.submittedAt,
    })
    .from(driverApplications)
    .where(eq(driverApplications.driverId, row.id))
    .limit(1);

  const [userRow] = await db
    .select({
      emailVerified: users.emailVerified,
      avatarUrl: users.avatarUrl,
      phone: users.phone,
      phoneCountry: users.phoneCountry,
      phoneChangedAt: users.phoneChangedAt,
      pdpaConsentAt: users.pdpaConsentAt,
    })
    .from(users)
    .where(eq(users.id, row.id))
    .limit(1);

  // Same rule as the rider path: send the first verification OTP only when WE
  // just created the row, there is an email, and Clerk hasn't already verified
  // it. Fire-and-forget; failures are logged, never block login.
  if (weCreatedTheRow && provisionedProfile?.email && !provisionedProfile.emailVerified) {
    const userId = row.id;
    const email = provisionedProfile.email;
    const fullName = provisionedProfile.fullName ?? null;
    void (async () => {
      try {
        await sendVerificationOtp({ userId, email, fullName });
      } catch (err) {
        logger.warn({ err, userId }, 'driver auto-send OTP failed');
      }
    })();
  }

  return {
    user: {
      id: row.id,
      email: row.email,
      emailVerified: userRow?.emailVerified ?? false,
      fullName: row.fullName,
      avatarUrl: userRow?.avatarUrl ?? null,
      phone: userRow?.phone ?? null,
      phoneCountry: userRow?.phoneCountry ?? null,
      phoneChangedAt: userRow?.phoneChangedAt?.toISOString() ?? null,
      status: row.status,
      pdpaConsentAt: userRow?.pdpaConsentAt?.toISOString() ?? null,
    },
    driverProfile: {
      approvalStatus: dp?.approvalStatus ?? 'pending',
    },
    application: application
      ? {
          state: application.state,
          rejectionReason: application.rejectionReason ?? null,
          submittedAt: application.submittedAt?.toISOString() ?? null,
        }
      : null,
  };
}

/** Records PDPA consent for a driver. Called right after Clerk sign-up. */
export async function acceptPdpaConsent(userId: string): Promise<void> {
  await recordPdpaConsent(userId);
}

// `phone` is deliberately absent: a number is no longer a field you can PATCH.
// Every change after registration needs an email OTP and is subject to the
// 30-day cooldown, which is what `modules/identity/phone.ts` exists for. The
// route rejects a `phone` key here with `400 use_phone_endpoint`.
export type RiderMePatch = {
  fullName?: string;
  locale?: 'en' | 'ms' | 'zh' | 'ta';
};

export async function patchRiderMe(userId: string, patch: RiderMePatch): Promise<void> {
  await updateRiderFields(userId, patch);
}

// There is deliberately no `patchDriverMe`. A driver's name and phone are
// identity evidence for APAD/JPJ, so they only change through the review queue
// in modules/profile-changes/ — an admin approval is what writes them.

/**
 * Sync handler for Clerk `user.updated` and `user.deleted` webhooks.
 */
export async function applyClerkWebhook(event: {
  type: 'user.updated' | 'user.deleted';
  clerkUserId: string;
  email?: string | null;
  fullName?: string | null;
  /** Clerk's `password_last_updated_at`, when the event carried one. */
  passwordChangedAt?: Date | null;
}): Promise<void> {
  const row = await findUserByExternalId('clerk', event.clerkUserId);
  if (!row) return; // never provisioned on our side; ignore

  if (event.type === 'user.deleted') {
    await softDeleteUser(row.id);
    return;
  }
  // Back-stop for the signed-out reset, which changes the password entirely
  // inside Clerk. `recordPasswordChanged` never moves the clock backwards, so
  // replaying an old `user.updated` cannot shorten an active cooldown.
  if (event.passwordChangedAt) {
    await recordPasswordChanged(row.id, event.passwordChangedAt);
  }
  await updateRiderFields(row.id, {
    email: event.email ?? null,
    fullName: event.fullName ?? null,
  });
}

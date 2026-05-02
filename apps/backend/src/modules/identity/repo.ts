// modules/identity/repo.ts
// Drizzle queries for the identity domain. Private to the module; routes
// must go through the service.
import { and, eq } from 'drizzle-orm';

import { db } from '../../config/db';
import {
  users,
  userRoles,
  externalIdentities,
  type localeEnum,
} from '../../db/schema/identity';
import { riderProfiles } from '../../db/schema/riders';

type Locale = (typeof localeEnum)['enumValues'][number];
type Role = 'rider' | 'driver' | 'admin_super' | 'admin_ops' | 'admin_finance';

export type IdentityRow = {
  id: string;
  email: string | null;
  fullName: string | null;
  locale: Locale;
  status: 'active' | 'suspended' | 'deactivated';
  role: Role;
};

export async function findUserByExternalId(
  provider: string,
  providerSub: string,
): Promise<IdentityRow | null> {
  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      fullName: users.fullName,
      locale: users.locale,
      status: users.status,
      role: userRoles.role,
    })
    .from(externalIdentities)
    .innerJoin(users, eq(users.id, externalIdentities.userId))
    .innerJoin(userRoles, eq(userRoles.userId, users.id))
    .where(
      and(
        eq(externalIdentities.provider, provider),
        eq(externalIdentities.providerSub, providerSub),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}

export type ProvisionInput = {
  clerkUserId: string;
  email?: string;
  fullName?: string;
  locale?: Locale;
};

/**
 * Atomic upsert: create user + rider role + clerk external_identity + rider_profile.
 * Returns the new user id. Caller is responsible for re-reading via findUserByExternalId.
 */
export async function provisionRider(input: ProvisionInput): Promise<string> {
  return await db.transaction(async (tx) => {
    const [user] = await tx
      .insert(users)
      .values({
        email: input.email ?? null,
        fullName: input.fullName ?? null,
        locale: input.locale ?? 'en',
      })
      .returning({ id: users.id });
    if (!user) throw new Error('failed to insert user');

    await tx.insert(userRoles).values({ userId: user.id, role: 'rider' });
    await tx
      .insert(externalIdentities)
      .values({
        userId: user.id,
        provider: 'clerk',
        providerSub: input.clerkUserId,
      });
    await tx.insert(riderProfiles).values({ userId: user.id });

    return user.id;
  });
}

export async function updateRiderFields(
  userId: string,
  patch: { fullName?: string | null; locale?: Locale; email?: string | null },
): Promise<void> {
  await db
    .update(users)
    .set({
      ...(patch.fullName !== undefined ? { fullName: patch.fullName } : {}),
      ...(patch.locale !== undefined ? { locale: patch.locale } : {}),
      ...(patch.email !== undefined ? { email: patch.email } : {}),
    })
    .where(eq(users.id, userId));
}

export async function softDeleteUser(userId: string): Promise<void> {
  await db
    .update(users)
    .set({ status: 'deactivated' })
    .where(eq(users.id, userId));
}

export async function getRiderProfileBundle(userId: string) {
  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      fullName: users.fullName,
      locale: users.locale,
      status: users.status,
      ratingAvg: riderProfiles.ratingAvg,
      ratingCount: riderProfiles.ratingCount,
      createdAt: users.createdAt,
    })
    .from(users)
    .leftJoin(riderProfiles, eq(riderProfiles.userId, users.id))
    .where(eq(users.id, userId))
    .limit(1);
  return rows[0] ?? null;
}

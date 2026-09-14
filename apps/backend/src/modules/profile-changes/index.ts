// modules/profile-changes/
// Review queue for name and phone edits — riders and drivers alike.
//
// Moved here from `modules/drivers/profile-changes.ts` when riders gained the
// early-phone-change request. Nothing in here knows which app the caller came
// from beyond the per-role phone rule, which is why the `role` is an argument
// rather than a module boundary.
//
// Two clocks, deliberately:
//   • `full_name` — the last approved request's `appliedAt`, 30 days. Unchanged.
//   • `phone`     — `users.phone_changed_at`, 30 days, stamped on *every*
//     successful write: rider self-service and admin approval alike. One clock
//     means a rider cannot get two changes a month by alternating paths.
//
// A rejected or cancelled request never touches either clock.
//
// Phone numbers are NOT unique (see the PRD's R1): there is deliberately no
// collision check here and no `phone_taken` outcome. Two accounts sharing a
// contact number is the expected case for someone who both rides and drives.

import { and, desc, eq, inArray, ne, sql } from 'drizzle-orm';
// Subpath, not the barrel — see the note in modules/identity/phone.ts. The
// barrel's `export *` is invisible to Node's CJS export lexer, so a static
// value import from '@teeko/shared' fails at link time in this ESM package.
import {
  PHONE_CHANGE_COOLDOWN_MS,
  phoneCooldownEnd,
  resolvePhoneForRole,
  revalidateE164,
  type PhoneError,
} from '@teeko/shared/utils/phone';

import { db } from '../../config/db';
import { isUniqueViolation } from '../../db/errors';
import { users, userRoles } from '../../db/schema/identity';
import { profileChangeRequests } from '../../db/schema/profile-changes';

/** One approved `full_name` change per 30 days. Phone uses the shared clock. */
export const PROFILE_CHANGE_COOLDOWN_MS = 30 * 24 * 60 * 60 * 1000;

export { PHONE_CHANGE_COOLDOWN_MS };

export type ProfileChangeField = 'full_name' | 'phone';
export type ProfileRole = 'rider' | 'driver';

export const PROFILE_CHANGE_FIELDS: ProfileChangeField[] = ['full_name', 'phone'];

export const FIELD_LABELS: Record<ProfileChangeField, string> = {
  full_name: 'Full name',
  phone: 'Phone number',
};

export type ProfileChangeRequestDto = {
  id: string;
  field: ProfileChangeField;
  currentValue: string | null;
  requestedValue: string;
  /** ISO-3166 alpha-2 for a phone request; null for a name request. */
  requestedCountry: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  /** Raised inside the 30-day window — a ⚠️ for the reviewer, not a rejection. */
  isEarly: boolean;
  /** The user's own words. Required on an early request, null otherwise. */
  reason: string | null;
  reviewNote: string | null;
  reviewedAt: string | null;
  appliedAt: string | null;
  createdAt: string;
};

/** Per-field view the apps render: what's in review, when the next edit unlocks. */
export type ProfileFieldState = {
  field: ProfileChangeField;
  /** The open request, if one is already in review. */
  pending: ProfileChangeRequestDto | null;
  /** Null when the field is editable right now. */
  nextAllowedAt: string | null;
  /**
   * Inside the window but an early request is still available. Always false
   * for `full_name`, which has no early path — the PRD changes the phone flow
   * only, and a name is not an operational contact detail.
   */
  canRequestEarly: boolean;
  /** Most recent decision, so the app can surface "rejected: <reason>" once. */
  lastDecision: ProfileChangeRequestDto | null;
};

export type SubmitResult =
  | { status: 'submitted'; request: ProfileChangeRequestDto }
  | { status: 'unchanged' }
  | { status: 'already_pending'; request: ProfileChangeRequestDto }
  | { status: 'cooldown'; nextAllowedAt: string }
  | { status: 'reason_required'; nextAllowedAt: string }
  | { status: 'invalid'; error: PhoneError };

function toDto(row: typeof profileChangeRequests.$inferSelect): ProfileChangeRequestDto {
  return {
    id: row.id,
    field: row.field as ProfileChangeField,
    currentValue: row.currentValue,
    requestedValue: row.requestedValue,
    requestedCountry: row.requestedCountry,
    status: row.status as ProfileChangeRequestDto['status'],
    isEarly: row.isEarly,
    reason: row.reason,
    reviewNote: row.reviewNote,
    reviewedAt: row.reviewedAt?.toISOString() ?? null,
    appliedAt: row.appliedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

/** 'driver' wins when a row somehow carries both — the stricter rule applies. */
export async function roleOf(userId: string): Promise<ProfileRole> {
  const rows = await db
    .select({ role: userRoles.role })
    .from(userRoles)
    .where(eq(userRoles.userId, userId));
  return rows.some((r) => r.role === 'driver') ? 'driver' : 'rider';
}

async function loadUser(userId: string) {
  const [row] = await db
    .select({
      fullName: users.fullName,
      phone: users.phone,
      phoneCountry: users.phoneCountry,
      phoneChangedAt: users.phoneChangedAt,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return row ?? null;
}

async function findOpenRequest(userId: string, field: ProfileChangeField) {
  const [row] = await db
    .select()
    .from(profileChangeRequests)
    .where(
      and(
        eq(profileChangeRequests.userId, userId),
        eq(profileChangeRequests.field, field),
        eq(profileChangeRequests.status, 'pending'),
      ),
    )
    .limit(1);
  return row ?? null;
}

/** Last applied change to this field — the `full_name` cooldown's clock. */
async function findLastApplied(userId: string, field: ProfileChangeField) {
  const [row] = await db
    .select()
    .from(profileChangeRequests)
    .where(
      and(
        eq(profileChangeRequests.userId, userId),
        eq(profileChangeRequests.field, field),
        eq(profileChangeRequests.status, 'approved'),
      ),
    )
    .orderBy(desc(profileChangeRequests.appliedAt))
    .limit(1);
  return row ?? null;
}

async function findLastDecision(userId: string, field: ProfileChangeField) {
  const [row] = await db
    .select()
    .from(profileChangeRequests)
    .where(
      and(
        eq(profileChangeRequests.userId, userId),
        eq(profileChangeRequests.field, field),
        ne(profileChangeRequests.status, 'pending'),
      ),
    )
    .orderBy(desc(profileChangeRequests.createdAt))
    .limit(1);
  return row ?? null;
}

function nameCooldownEnd(appliedAt: Date | null): Date | null {
  if (!appliedAt) return null;
  const end = new Date(appliedAt.getTime() + PROFILE_CHANGE_COOLDOWN_MS);
  return end.getTime() > Date.now() ? end : null;
}

/**
 * When the field unlocks, per its own clock. Null means "editable now".
 * Phone reads `users.phone_changed_at` so a self-service rider change and an
 * admin-approved driver change count against the same allowance.
 */
async function cooldownFor(
  userId: string,
  field: ProfileChangeField,
  user: Awaited<ReturnType<typeof loadUser>>,
): Promise<Date | null> {
  if (field === 'phone') return phoneCooldownEnd(user?.phoneChangedAt ?? null);
  const lastApplied = await findLastApplied(userId, field);
  return nameCooldownEnd(lastApplied?.appliedAt ?? null);
}

/** Everything the apps need to render the personal-info screen. */
export async function getFieldStates(userId: string): Promise<ProfileFieldState[]> {
  const user = await loadUser(userId);
  return Promise.all(
    PROFILE_CHANGE_FIELDS.map(async (field) => {
      const [pending, lastDecision, end] = await Promise.all([
        findOpenRequest(userId, field),
        findLastDecision(userId, field),
        cooldownFor(userId, field, user),
      ]);
      return {
        field,
        pending: pending ? toDto(pending) : null,
        nextAllowedAt: end?.toISOString() ?? null,
        // An early request is a phone affordance, and only while the window is
        // actually closed and nothing is already in review.
        canRequestEarly: field === 'phone' && !!end && !pending,
        lastDecision: lastDecision ? toDto(lastDecision) : null,
      };
    }),
  );
}

/**
 * Raise a change request for one field.
 *
 * Callers must have verified the user's email OTP first for a phone request —
 * this module does not know about OTPs, it only records the decision.
 *
 * Inside the 30-day window a **phone** request is still accepted, flagged
 * `is_early` and required to carry a reason; a **name** request is refused
 * outright, exactly as before. Rejections and cancellations cost nothing.
 */
export async function submitProfileChange(input: {
  userId: string;
  role?: ProfileRole;
  field: ProfileChangeField;
  /** Free-form for `full_name`; the national number for `phone`. */
  value: string;
  /** ISO-3166 alpha-2 for a phone request. Drivers are forced to 'MY'. */
  countryCode?: string | null;
  /** Required when the request lands inside the window. */
  reason?: string | null;
}): Promise<SubmitResult> {
  const role = input.role ?? (await roleOf(input.userId));
  const user = await loadUser(input.userId);

  let requested: string | null;
  let requestedCountry: string | null = null;

  if (input.field === 'phone') {
    const resolved = resolvePhoneForRole(role, {
      countryCode: input.countryCode,
      nationalNumber: input.value,
    });
    if (!resolved.ok) return { status: 'invalid', error: resolved.error };
    requested = resolved.e164;
    requestedCountry = resolved.iso2;
  } else {
    requested = input.value.trim() || null;
    if (!requested) return { status: 'unchanged' };
  }

  const current = input.field === 'phone' ? (user?.phone ?? null) : (user?.fullName ?? null);
  // Same number *and* same country is a no-op; the same digits under a
  // different ISO-2 is a real correction the picker has to be able to make.
  const sameCountry = input.field !== 'phone' || requestedCountry === (user?.phoneCountry ?? null);
  if (current === requested && sameCountry) return { status: 'unchanged' };

  const open = await findOpenRequest(input.userId, input.field);
  if (open) return { status: 'already_pending', request: toDto(open) };

  const end = await cooldownFor(input.userId, input.field, user);
  const reason = input.reason?.trim() || null;
  let isEarly = false;
  if (end) {
    // A name change inside its window has no escape hatch — unchanged policy.
    if (input.field !== 'phone') return { status: 'cooldown', nextAllowedAt: end.toISOString() };
    if (!reason) return { status: 'reason_required', nextAllowedAt: end.toISOString() };
    isEarly = true;
  }

  try {
    const [row] = await db
      .insert(profileChangeRequests)
      .values({
        userId: input.userId,
        field: input.field,
        currentValue: current,
        requestedValue: requested,
        requestedCountry,
        isEarly,
        // A reason outside the window is noise the reviewer did not ask for.
        reason: isEarly ? reason : null,
      })
      .returning();
    return { status: 'submitted', request: toDto(row!) };
  } catch (err) {
    // Lost a race against the user's own double-tap; the partial unique index
    // on (user_id, field) WHERE pending is what fired.
    if (!isUniqueViolation(err)) throw err;
    const existing = await findOpenRequest(input.userId, input.field);
    if (existing) return { status: 'already_pending', request: toDto(existing) };
    throw err;
  }
}

/** The user withdrew the request before an admin looked at it. */
export async function cancelProfileChange(
  userId: string,
  requestId: string,
): Promise<'cancelled' | 'not_found'> {
  const rows = await db
    .update(profileChangeRequests)
    .set({ status: 'cancelled', reviewedAt: new Date() })
    .where(
      and(
        eq(profileChangeRequests.id, requestId),
        eq(profileChangeRequests.userId, userId),
        eq(profileChangeRequests.status, 'pending'),
      ),
    )
    .returning({ id: profileChangeRequests.id });
  return rows.length ? 'cancelled' : 'not_found';
}

export async function listUserRequests(userId: string): Promise<ProfileChangeRequestDto[]> {
  const rows = await db
    .select()
    .from(profileChangeRequests)
    .where(eq(profileChangeRequests.userId, userId))
    .orderBy(desc(profileChangeRequests.createdAt))
    .limit(50);
  return rows.map(toDto);
}

// ── Admin side ──────────────────────────────────────────────────────────────

export type AdminChangeRequestDto = ProfileChangeRequestDto & {
  userId: string;
  userName: string | null;
  userEmail: string | null;
  role: ProfileRole;
  /**
   * When the user last changed their number. Shown next to the ⚠️ badge so the
   * reviewer can see how early "early" is without opening the detail page.
   */
  phoneChangedAt: string | null;
  reviewedByName: string | null;
};

/** Pending queue, optionally narrowed to one user or one role. */
export async function listChangeRequestsForAdmin(opts: {
  userId?: string;
  role?: ProfileRole;
  status?: 'pending' | 'approved' | 'rejected' | 'cancelled';
  limit?: number;
}): Promise<AdminChangeRequestDto[]> {
  const filters = [
    opts.userId ? eq(profileChangeRequests.userId, opts.userId) : undefined,
    opts.status ? eq(profileChangeRequests.status, opts.status) : undefined,
  ].filter(Boolean);

  const rows = await db
    .select({
      req: profileChangeRequests,
      userName: users.fullName,
      userEmail: users.email,
      phoneChangedAt: users.phoneChangedAt,
    })
    .from(profileChangeRequests)
    .innerJoin(users, eq(users.id, profileChangeRequests.userId))
    .where(filters.length ? and(...filters) : undefined)
    .orderBy(desc(profileChangeRequests.createdAt))
    .limit(opts.limit ?? 200);

  // Roles and reviewer names in one follow-up query each — cheaper than two
  // more joins for a queue this small, and null-safe for the unreviewed rows.
  const subjectIds = [...new Set(rows.map((r) => r.req.userId))];
  const roles = new Map<string, ProfileRole>();
  if (subjectIds.length) {
    const roleRows = await db
      .select({ userId: userRoles.userId, role: userRoles.role })
      .from(userRoles)
      .where(inArray(userRoles.userId, subjectIds));
    for (const r of roleRows) {
      if (r.role === 'driver') roles.set(r.userId, 'driver');
      else if (r.role === 'rider' && !roles.has(r.userId)) roles.set(r.userId, 'rider');
    }
  }

  const reviewerIds = [...new Set(rows.map((r) => r.req.reviewedBy).filter(Boolean))] as string[];
  const reviewerNames = new Map<string, string | null>();
  if (reviewerIds.length) {
    const names = await db
      .select({ id: users.id, fullName: users.fullName })
      .from(users)
      .where(inArray(users.id, reviewerIds));
    for (const n of names) reviewerNames.set(n.id, n.fullName);
  }

  return rows
    .map((r) => ({
      ...toDto(r.req),
      userId: r.req.userId,
      userName: r.userName,
      userEmail: r.userEmail,
      role: roles.get(r.req.userId) ?? ('rider' as ProfileRole),
      phoneChangedAt: r.phoneChangedAt?.toISOString() ?? null,
      reviewedByName: r.req.reviewedBy ? (reviewerNames.get(r.req.reviewedBy) ?? null) : null,
    }))
    // Filtered after the role lookup rather than in SQL: the join would need a
    // third table and the queue is small enough that it is not worth it.
    .filter((r) => !opts.role || r.role === opts.role);
}

export type ReviewResult =
  | { status: 'approved'; request: AdminChangeRequestDto }
  | { status: 'rejected'; request: AdminChangeRequestDto }
  | { status: 'not_pending' }
  | { status: 'not_found' }
  | { status: 'invalid'; error: PhoneError };

/**
 * Approve or reject one request. An approval writes the value onto `users` and
 * stamps `appliedAt` in the same transaction, so a cooldown clock can never
 * start without the change actually landing.
 *
 * A phone approval additionally writes `phone_country` and restarts the shared
 * `phone_changed_at` clock, and re-validates the number first — the per-role
 * country rule may have tightened between submission and review.
 */
export async function reviewProfileChange(input: {
  requestId: string;
  decision: 'approve' | 'reject';
  adminId: string;
  note?: string | null;
}): Promise<ReviewResult> {
  const [row] = await db
    .select()
    .from(profileChangeRequests)
    .where(eq(profileChangeRequests.id, input.requestId))
    .limit(1);
  if (!row) return { status: 'not_found' };
  if (row.status !== 'pending') return { status: 'not_pending' };

  const now = new Date();

  if (input.decision === 'reject') {
    await db
      .update(profileChangeRequests)
      .set({
        status: 'rejected',
        reviewedBy: input.adminId,
        reviewedAt: now,
        reviewNote: input.note ?? null,
      })
      .where(eq(profileChangeRequests.id, row.id));
    return { status: 'rejected', request: await reloadForAdmin(row.userId, row.id) };
  }

  const field = row.field as ProfileChangeField;

  if (field === 'phone') {
    const role = await roleOf(row.userId);
    const check = revalidateE164(role, row.requestedValue, row.requestedCountry);
    // Deliberately does NOT check uniqueness: numbers are not identity keys.
    if (!check.ok) return { status: 'invalid', error: check.error };
  }

  await db.transaction(async (tx) => {
    await tx
      .update(users)
      .set(
        field === 'phone'
          ? {
              phone: row.requestedValue,
              phoneCountry: row.requestedCountry,
              // Restarts the 30-day clock, same column the rider's
              // self-service path stamps.
              phoneChangedAt: now,
            }
          : { fullName: row.requestedValue },
      )
      .where(eq(users.id, row.userId));
    await tx
      .update(profileChangeRequests)
      .set({
        status: 'approved',
        reviewedBy: input.adminId,
        reviewedAt: now,
        reviewNote: input.note ?? null,
        appliedAt: now,
      })
      .where(eq(profileChangeRequests.id, row.id));
  });

  return { status: 'approved', request: await reloadForAdmin(row.userId, row.id) };
}

async function reloadForAdmin(userId: string, requestId: string): Promise<AdminChangeRequestDto> {
  const all = await listChangeRequestsForAdmin({ userId });
  const dto = all.find((r) => r.id === requestId);
  if (!dto) throw new Error('reviewed request vanished');
  return dto;
}

/** Badge count for the admin sidebar. */
export async function countPendingChangeRequests(): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(profileChangeRequests)
    .where(eq(profileChangeRequests.status, 'pending'));
  return row?.n ?? 0;
}

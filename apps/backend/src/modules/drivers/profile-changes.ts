// modules/drivers/profile-changes.ts
// Review queue for driver self-service profile edits.
//
// A driver's name and phone are the identity evidence behind their PSV-D and
// the APAD/JPJ operator record, so the driver app cannot write them directly.
// An edit raises a `pending` request; an admin approves it, and only then does
// the value reach `users`. Each field carries its own 30-day cooldown measured
// from the last *applied* change — a rejection costs the driver nothing.

import { and, desc, eq, inArray, isNull, ne, sql } from 'drizzle-orm';

import { db } from '../../config/db';
import { isUniqueViolation } from '../../db/errors';
import { driverProfileChangeRequests } from '../../db/schema/drivers';
import { users } from '../../db/schema/identity';
import { normalizePhone } from '../identity/service';

/** One approved change per field per 30 days. */
export const PROFILE_CHANGE_COOLDOWN_MS = 30 * 24 * 60 * 60 * 1000;

export type ProfileChangeField = 'full_name' | 'phone';

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
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  reviewNote: string | null;
  reviewedAt: string | null;
  appliedAt: string | null;
  createdAt: string;
};

/** Per-field view the driver app renders: what's in review, when the next edit unlocks. */
export type ProfileFieldState = {
  field: ProfileChangeField;
  /** The open request, if the driver already has one in review. */
  pending: ProfileChangeRequestDto | null;
  /** Null when the field is editable right now. */
  nextAllowedAt: string | null;
  /** Most recent decision, so the app can surface "rejected: <reason>" once. */
  lastDecision: ProfileChangeRequestDto | null;
};

export type SubmitResult =
  | { status: 'submitted'; request: ProfileChangeRequestDto }
  | { status: 'unchanged' }
  | { status: 'already_pending'; request: ProfileChangeRequestDto }
  | { status: 'cooldown'; nextAllowedAt: string }
  | { status: 'phone_taken' };

function toDto(row: typeof driverProfileChangeRequests.$inferSelect): ProfileChangeRequestDto {
  return {
    id: row.id,
    field: row.field as ProfileChangeField,
    currentValue: row.currentValue,
    requestedValue: row.requestedValue,
    status: row.status as ProfileChangeRequestDto['status'],
    reviewNote: row.reviewNote,
    reviewedAt: row.reviewedAt?.toISOString() ?? null,
    appliedAt: row.appliedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

/** Normalise the incoming value the same way the column would have stored it. */
function canonicalise(field: ProfileChangeField, value: string): string | null {
  if (field === 'phone') return normalizePhone(value);
  const trimmed = value.trim();
  return trimmed || null;
}

function currentValueOf(
  field: ProfileChangeField,
  user: { fullName: string | null; phone: string | null },
): string | null {
  return field === 'phone' ? user.phone : user.fullName;
}

async function findOpenRequest(driverId: string, field: ProfileChangeField) {
  const [row] = await db
    .select()
    .from(driverProfileChangeRequests)
    .where(
      and(
        eq(driverProfileChangeRequests.driverId, driverId),
        eq(driverProfileChangeRequests.field, field),
        eq(driverProfileChangeRequests.status, 'pending'),
      ),
    )
    .limit(1);
  return row ?? null;
}

/** Last applied change to this field, which is what the cooldown counts from. */
async function findLastApplied(driverId: string, field: ProfileChangeField) {
  const [row] = await db
    .select()
    .from(driverProfileChangeRequests)
    .where(
      and(
        eq(driverProfileChangeRequests.driverId, driverId),
        eq(driverProfileChangeRequests.field, field),
        eq(driverProfileChangeRequests.status, 'approved'),
      ),
    )
    .orderBy(desc(driverProfileChangeRequests.appliedAt))
    .limit(1);
  return row ?? null;
}

async function findLastDecision(driverId: string, field: ProfileChangeField) {
  const [row] = await db
    .select()
    .from(driverProfileChangeRequests)
    .where(
      and(
        eq(driverProfileChangeRequests.driverId, driverId),
        eq(driverProfileChangeRequests.field, field),
        ne(driverProfileChangeRequests.status, 'pending'),
      ),
    )
    .orderBy(desc(driverProfileChangeRequests.createdAt))
    .limit(1);
  return row ?? null;
}

function cooldownEnd(appliedAt: Date | null): Date | null {
  if (!appliedAt) return null;
  const end = new Date(appliedAt.getTime() + PROFILE_CHANGE_COOLDOWN_MS);
  return end.getTime() > Date.now() ? end : null;
}

/** Everything the driver app needs to render the personal-info screen. */
export async function getFieldStates(driverId: string): Promise<ProfileFieldState[]> {
  return Promise.all(
    PROFILE_CHANGE_FIELDS.map(async (field) => {
      const [pending, lastApplied, lastDecision] = await Promise.all([
        findOpenRequest(driverId, field),
        findLastApplied(driverId, field),
        findLastDecision(driverId, field),
      ]);
      const end = cooldownEnd(lastApplied?.appliedAt ?? null);
      return {
        field,
        pending: pending ? toDto(pending) : null,
        nextAllowedAt: end?.toISOString() ?? null,
        lastDecision: lastDecision ? toDto(lastDecision) : null,
      };
    }),
  );
}

/**
 * Raise a change request for one field. Rejects — without touching `users` —
 * when the value is unchanged, a request is already in review, the field is
 * still inside its 30-day cooldown, or the phone belongs to someone else.
 */
export async function submitProfileChange(input: {
  driverId: string;
  field: ProfileChangeField;
  value: string;
}): Promise<SubmitResult> {
  const requested = canonicalise(input.field, input.value);
  if (!requested) return { status: 'unchanged' };

  const [user] = await db
    .select({ fullName: users.fullName, phone: users.phone })
    .from(users)
    .where(eq(users.id, input.driverId))
    .limit(1);
  const current = user ? currentValueOf(input.field, user) : null;
  if (current === requested) return { status: 'unchanged' };

  const open = await findOpenRequest(input.driverId, input.field);
  if (open) return { status: 'already_pending', request: toDto(open) };

  const lastApplied = await findLastApplied(input.driverId, input.field);
  const end = cooldownEnd(lastApplied?.appliedAt ?? null);
  if (end) return { status: 'cooldown', nextAllowedAt: end.toISOString() };

  // Catch a collision now rather than letting the driver wait days for a
  // review that can only end in a unique-violation on apply.
  if (input.field === 'phone' && (await phoneTakenBy(requested, input.driverId))) {
    return { status: 'phone_taken' };
  }

  try {
    const [row] = await db
      .insert(driverProfileChangeRequests)
      .values({
        driverId: input.driverId,
        field: input.field,
        currentValue: current,
        requestedValue: requested,
      })
      .returning();
    return { status: 'submitted', request: toDto(row!) };
  } catch (err) {
    // Lost a race against the driver's own double-tap; the partial unique index
    // on (driver_id, field) WHERE pending is what fired.
    if (!isUniqueViolation(err)) throw err;
    const existing = await findOpenRequest(input.driverId, input.field);
    if (existing) return { status: 'already_pending', request: toDto(existing) };
    throw err;
  }
}

async function phoneTakenBy(phone: string, exceptUserId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.phone, phone), ne(users.id, exceptUserId), isNull(users.deletedAt)))
    .limit(1);
  return !!row;
}

/** The driver withdrew the request before an admin looked at it. */
export async function cancelProfileChange(
  driverId: string,
  requestId: string,
): Promise<'cancelled' | 'not_found'> {
  const rows = await db
    .update(driverProfileChangeRequests)
    .set({ status: 'cancelled', reviewedAt: new Date() })
    .where(
      and(
        eq(driverProfileChangeRequests.id, requestId),
        eq(driverProfileChangeRequests.driverId, driverId),
        eq(driverProfileChangeRequests.status, 'pending'),
      ),
    )
    .returning({ id: driverProfileChangeRequests.id });
  return rows.length ? 'cancelled' : 'not_found';
}

export async function listDriverRequests(driverId: string): Promise<ProfileChangeRequestDto[]> {
  const rows = await db
    .select()
    .from(driverProfileChangeRequests)
    .where(eq(driverProfileChangeRequests.driverId, driverId))
    .orderBy(desc(driverProfileChangeRequests.createdAt))
    .limit(50);
  return rows.map(toDto);
}

// ── Admin side ──────────────────────────────────────────────────────────────

export type AdminChangeRequestDto = ProfileChangeRequestDto & {
  driverId: string;
  driverName: string | null;
  driverEmail: string | null;
  reviewedByName: string | null;
};

/** Pending queue, optionally narrowed to one driver (the driver detail page). */
export async function listChangeRequestsForAdmin(opts: {
  driverId?: string;
  status?: 'pending' | 'approved' | 'rejected' | 'cancelled';
  limit?: number;
}): Promise<AdminChangeRequestDto[]> {
  const filters = [
    opts.driverId ? eq(driverProfileChangeRequests.driverId, opts.driverId) : undefined,
    opts.status ? eq(driverProfileChangeRequests.status, opts.status) : undefined,
  ].filter(Boolean);

  const rows = await db
    .select({
      req: driverProfileChangeRequests,
      driverName: users.fullName,
      driverEmail: users.email,
    })
    .from(driverProfileChangeRequests)
    .innerJoin(users, eq(users.id, driverProfileChangeRequests.driverId))
    .where(filters.length ? and(...filters) : undefined)
    .orderBy(desc(driverProfileChangeRequests.createdAt))
    .limit(opts.limit ?? 200);

  // Reviewer names in one follow-up query — cheaper than a second self-join for
  // a queue this small, and null-safe for the not-yet-reviewed rows.
  const reviewerIds = [...new Set(rows.map((r) => r.req.reviewedBy).filter(Boolean))] as string[];
  const reviewerNames = new Map<string, string | null>();
  if (reviewerIds.length) {
    const names = await db
      .select({ id: users.id, fullName: users.fullName })
      .from(users)
      .where(inArray(users.id, reviewerIds));
    for (const n of names) reviewerNames.set(n.id, n.fullName);
  }

  return rows.map((r) => ({
    ...toDto(r.req),
    driverId: r.req.driverId,
    driverName: r.driverName,
    driverEmail: r.driverEmail,
    reviewedByName: r.req.reviewedBy ? (reviewerNames.get(r.req.reviewedBy) ?? null) : null,
  }));
}

export type ReviewResult =
  | { status: 'approved'; request: AdminChangeRequestDto }
  | { status: 'rejected'; request: AdminChangeRequestDto }
  | { status: 'not_pending' }
  | { status: 'not_found' }
  | { status: 'phone_taken' };

/**
 * Approve or reject one request. An approval writes the value onto `users` and
 * stamps `appliedAt` in the same transaction, so the cooldown clock can never
 * start without the change actually landing.
 */
export async function reviewProfileChange(input: {
  requestId: string;
  decision: 'approve' | 'reject';
  adminId: string;
  note?: string | null;
}): Promise<ReviewResult> {
  const [row] = await db
    .select()
    .from(driverProfileChangeRequests)
    .where(eq(driverProfileChangeRequests.id, input.requestId))
    .limit(1);
  if (!row) return { status: 'not_found' };
  if (row.status !== 'pending') return { status: 'not_pending' };

  const now = new Date();

  if (input.decision === 'reject') {
    await db
      .update(driverProfileChangeRequests)
      .set({
        status: 'rejected',
        reviewedBy: input.adminId,
        reviewedAt: now,
        reviewNote: input.note ?? null,
      })
      .where(eq(driverProfileChangeRequests.id, row.id));
    return { status: 'rejected', request: await reloadForAdmin(row.driverId, row.id) };
  }

  const field = row.field as ProfileChangeField;
  try {
    await db.transaction(async (tx) => {
      await tx
        .update(users)
        .set(field === 'phone' ? { phone: row.requestedValue } : { fullName: row.requestedValue })
        .where(eq(users.id, row.driverId));
      await tx
        .update(driverProfileChangeRequests)
        .set({
          status: 'approved',
          reviewedBy: input.adminId,
          reviewedAt: now,
          reviewNote: input.note ?? null,
          appliedAt: now,
        })
        .where(eq(driverProfileChangeRequests.id, row.id));
    });
  } catch (err) {
    // Someone else claimed the number between submission and review.
    if (isUniqueViolation(err)) return { status: 'phone_taken' };
    throw err;
  }

  return { status: 'approved', request: await reloadForAdmin(row.driverId, row.id) };
}

async function reloadForAdmin(driverId: string, requestId: string): Promise<AdminChangeRequestDto> {
  const all = await listChangeRequestsForAdmin({ driverId });
  const dto = all.find((r) => r.id === requestId);
  if (!dto) throw new Error('reviewed request vanished');
  return dto;
}

/** Badge count for the admin drivers list. */
export async function countPendingChangeRequests(): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(driverProfileChangeRequests)
    .where(eq(driverProfileChangeRequests.status, 'pending'));
  return row?.n ?? 0;
}

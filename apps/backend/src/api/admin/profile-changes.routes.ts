import type { FastifyInstance } from 'fastify';

import { db } from '../../config/db';
import { notificationInbox } from '../../db/schema/notifications-content';
import { recordAudit, recordAuditSafe } from '../../modules/admin/audit';
import {
  FIELD_LABELS,
  countPendingChangeRequests,
  listChangeRequestsForAdmin,
  reviewProfileChange,
  type ProfileChangeField,
} from '../../modules/profile-changes';

const STATUSES = ['pending', 'approved', 'rejected', 'cancelled'] as const;
type Status = (typeof STATUSES)[number];
const ROLES = ['rider', 'driver'] as const;
type Role = (typeof ROLES)[number];

// Mounted at /api/v1/admin/profile-changes (was /admin/driver-profile-changes
// while the queue was drivers-only).
//
// A driver's name and phone are identity evidence behind their PSV-D and the
// APAD/JPJ operator record, so every driver edit lands here as a request and
// only reaches `users` when an admin approves it. Riders write their own
// number, but land here when they want a second change inside 30 days.
export async function routes(app: FastifyInstance) {
  // GET / — the review queue. `?status=` defaults to pending (what the badge
  // counts); `?userId=` narrows it to one person's detail page; `?role=`
  // splits riders from drivers.
  app.get<{ Querystring: { status?: string; userId?: string; driverId?: string; role?: string } }>(
    '/',
    async (req, reply) => {
      const { status, role } = req.query ?? {};
      // `driverId` accepted as an alias so the driver detail page keeps working
      // through the rename.
      const userId = req.query?.userId || req.query?.driverId;
      if (status && status !== 'all' && !STATUSES.includes(status as Status)) {
        return reply.code(400).send({ error: 'invalid_status' });
      }
      if (role && role !== 'all' && !ROLES.includes(role as Role)) {
        return reply.code(400).send({ error: 'invalid_role' });
      }
      const requests = await listChangeRequestsForAdmin({
        userId: userId || undefined,
        role: role && role !== 'all' ? (role as Role) : undefined,
        // A detail page wants the whole history; the queue wants pending.
        status:
          status === 'all' ? undefined : ((status as Status) ?? (userId ? undefined : 'pending')),
      });
      return { requests, pendingCount: await countPendingChangeRequests() };
    },
  );

  // GET /count — badge for the admin sidebar.
  app.get('/count', async () => ({ pending: await countPendingChangeRequests() }));

  // POST /:requestId/review — approve (writes the value onto the account and
  // starts that field's 30-day cooldown) or reject (costs the user nothing).
  app.post<{
    Params: { requestId: string };
    Body: { decision?: string; note?: string };
  }>('/:requestId/review', async (req, reply) => {
    const { requestId } = req.params;
    const { decision, note } = req.body ?? {};

    if (decision !== 'approve' && decision !== 'reject') {
      return reply.code(400).send({ error: 'invalid_decision' });
    }
    // A rejection the user cannot read is just an unexplained refusal.
    if (decision === 'reject' && !note?.trim()) {
      return reply.code(400).send({ error: 'note_required' });
    }

    const result = await reviewProfileChange({
      requestId,
      decision,
      adminId: req.user!.id,
      note: note?.trim() || null,
    });

    switch (result.status) {
      case 'not_found':
        return reply.code(404).send({ error: 'request_not_found' });
      case 'not_pending':
        return reply.code(409).send({ error: 'already_reviewed' });
      case 'invalid':
        // The per-role country rule tightened between submission and review.
        // Deliberately not a uniqueness check: numbers are not identity keys.
        return reply.code(400).send({ error: result.error });
      default:
        break;
    }

    const r = result.request;
    const label = FIELD_LABELS[r.field as ProfileChangeField] ?? r.field;

    await recordAudit(req, {
      action: 'profile_change_review',
      targetType: r.role,
      targetId: r.userId,
      targetName: r.userName ?? r.userId,
      details:
        result.status === 'approved'
          ? `${label} changed from "${r.currentValue ?? '—'}" to "${r.requestedValue}"`
          : `${label} change rejected — ${r.reviewNote ?? 'no reason given'}`,
      payload: {
        requestId: r.id,
        field: r.field,
        decision,
        from: r.currentValue,
        to: r.requestedValue,
        note: r.reviewNote,
      },
    });

    // Tell the user. Best-effort: a failed inbox write must not undo a
    // decision that has already been applied to the account.
    try {
      await db.insert(notificationInbox).values({
        userId: r.userId,
        category: 'evp',
        title:
          result.status === 'approved'
            ? `${label} updated`
            : `${label} change not approved`,
        body:
          result.status === 'approved'
            ? `Your ${label.toLowerCase()} is now "${r.requestedValue}". You can request another change in 30 days.`
            : `Your request to change your ${label.toLowerCase()} was not approved. ${r.reviewNote ?? ''}`.trim(),
        deeplink: '/account/personal',
        refId: r.id,
      });
    } catch (err) {
      req.log.error({ err, requestId: r.id }, 'profile-change decision notification failed');
      await recordAuditSafe(req, {
        action: 'profile_change_notify_failed',
        targetType: r.role,
        targetId: r.userId,
        targetName: r.userName ?? r.userId,
        details: 'Decision applied but the user was not notified in-app',
        payload: { requestId: r.id },
      });
    }

    return { ok: true, request: r };
  });
}

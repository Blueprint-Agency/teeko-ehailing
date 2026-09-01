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
} from '../../modules/drivers/profile-changes';

const STATUSES = ['pending', 'approved', 'rejected', 'cancelled'] as const;
type Status = (typeof STATUSES)[number];

// Mounted at /api/v1/admin/driver-profile-changes.
//
// A driver's name and phone are identity evidence behind their PSV-D and the
// APAD/JPJ operator record, so a self-service edit lands here as a request and
// only reaches `users` when an admin approves it.
export async function routes(app: FastifyInstance) {
  // GET / — the review queue. `?status=` defaults to pending (what the badge
  // counts); `?driverId=` narrows it to one driver's detail page.
  app.get<{ Querystring: { status?: string; driverId?: string } }>('/', async (req, reply) => {
    const { status, driverId } = req.query ?? {};
    if (status && status !== 'all' && !STATUSES.includes(status as Status)) {
      return reply.code(400).send({ error: 'invalid_status' });
    }
    const requests = await listChangeRequestsForAdmin({
      driverId: driverId || undefined,
      // A driver's detail page wants the whole history; the queue wants pending.
      status: status === 'all' ? undefined : ((status as Status) ?? (driverId ? undefined : 'pending')),
    });
    return { requests, pendingCount: await countPendingChangeRequests() };
  });

  // GET /count — badge for the drivers list.
  app.get('/count', async () => ({ pending: await countPendingChangeRequests() }));

  // POST /:requestId/review — approve (writes the value onto the account and
  // starts that field's 30-day cooldown) or reject (costs the driver nothing).
  app.post<{
    Params: { requestId: string };
    Body: { decision?: string; note?: string };
  }>('/:requestId/review', async (req, reply) => {
    const { requestId } = req.params;
    const { decision, note } = req.body ?? {};

    if (decision !== 'approve' && decision !== 'reject') {
      return reply.code(400).send({ error: 'invalid_decision' });
    }
    // A rejection the driver cannot read is just an unexplained refusal.
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
      case 'phone_taken':
        // Someone else claimed the number between submission and review.
        return reply.code(409).send({ error: 'phone_taken' });
      default:
        break;
    }

    const r = result.request;
    const label = FIELD_LABELS[r.field as ProfileChangeField] ?? r.field;

    await recordAudit(req, {
      action: 'driver_profile_change_review',
      targetType: 'driver',
      targetId: r.driverId,
      targetName: r.driverName ?? r.driverId,
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

    // Tell the driver. Best-effort: a failed inbox write must not undo a
    // decision that has already been applied to the account.
    try {
      await db.insert(notificationInbox).values({
        userId: r.driverId,
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
        action: 'driver_profile_change_notify_failed',
        targetType: 'driver',
        targetId: r.driverId,
        targetName: r.driverName ?? r.driverId,
        details: 'Decision applied but the driver was not notified in-app',
        payload: { requestId: r.id },
      });
    }

    return { ok: true, request: r };
  });
}

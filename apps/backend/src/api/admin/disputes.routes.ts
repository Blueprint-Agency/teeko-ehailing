import type { FastifyInstance } from 'fastify';
import { desc, eq, inArray } from 'drizzle-orm';
import { db } from '../../config/db';
import { disputes } from '../../db/schema/trips';
import { users } from '../../db/schema/identity';

// ── Constants ────────────────────────────────────────────────────────────────
// Which statuses belong to each admin queue.
const QUEUE_STATUSES = {
  dispute: ['open'],
  refund: ['refund_pending', 'refund_processing', 'refund_failed'],
  completed: ['refund_completed', 'rejected'],
} as const;

type Queue = keyof typeof QUEUE_STATUSES;

// Statuses an admin may move a refund into from the Refund Queue.
const REFUND_TARGETS = ['refund_processing', 'refund_completed', 'refund_failed'] as const;
type RefundTarget = (typeof REFUND_TARGETS)[number];

type DisputeRow = typeof disputes.$inferSelect;

// ── Helpers ───────────────────────────────────────────────────────────────────
function serialize(row: DisputeRow & { raiserName?: string | null }) {
  return {
    id: row.id,
    tripId: row.tripId ? row.tripId.slice(0, 8) : null,
    // Staging's disputes are always rider-raised (riderId is the submitter).
    raisedBy: 'rider' as const,
    raiserName: row.raiserName ?? '—',
    category: row.category,
    status: row.status,
    amount: (row.amountCents ?? 0) / 100,
    amountCents: row.amountCents ?? 0,
    description: row.description,
    resolutionNote: row.resolution,
    refundNote: row.refundNote,
    refundRef: row.refundRef,
    resolvedAt: row.resolvedAt,
    createdAt: row.createdAt,
  };
}

async function findDispute(id: string) {
  return db.query.disputes.findFirst({ where: eq(disputes.id, id) });
}

// ── Routes ────────────────────────────────────────────────────────────────────
export async function routes(app: FastifyInstance) {
  // ── GET /disputes ──────────────────────────────────────────────────────────
  // List disputes. `?queue=dispute|refund|completed` filters to one queue;
  // omit to return every dispute.
  app.get<{ Querystring: { queue?: Queue } }>('/', async (req, reply) => {
    const { queue } = req.query;
    if (queue && !(queue in QUEUE_STATUSES)) {
      return reply.code(400).send({ error: 'invalid_queue', validQueues: Object.keys(QUEUE_STATUSES) });
    }

    const rows = await db
      .select({
        dispute: disputes,
        raiserName: users.fullName,
      })
      .from(disputes)
      .leftJoin(users, eq(users.id, disputes.riderId))
      .where(queue ? inArray(disputes.status, [...QUEUE_STATUSES[queue]]) : undefined)
      .orderBy(desc(disputes.createdAt));

    return rows.map((r) => serialize({ ...r.dispute, raiserName: r.raiserName }));
  });

  // ── POST /disputes/:id/resolve ─────────────────────────────────────────────
  // Act on a dispute in the Dispute Queue.
  //   action 'reject'         → rejected (terminal, shown in Completion)
  //   action 'approve_refund' → refund_pending (moves to the Refund Queue)
  app.post<{ Params: { id: string }; Body: { action?: string; note?: string } }>(
    '/:id/resolve',
    async (req, reply) => {
      const { id } = req.params;
      const { action, note } = req.body ?? {};

      const dispute = await findDispute(id);
      if (!dispute) return reply.code(404).send({ error: 'dispute_not_found' });

      const now = new Date();
      const handledBy = req.user?.id ?? null;

      if (action === 'reject') {
        const [row] = await db
          .update(disputes)
          .set({ status: 'rejected', resolution: note ?? null, handledBy, resolvedAt: now })
          .where(eq(disputes.id, id))
          .returning();
        return { ok: true, dispute: serialize(row!) };
      }

      if (action === 'approve_refund') {
        if ((dispute.amountCents ?? 0) <= 0) {
          return reply.code(400).send({ error: 'no_refund_amount', message: 'Dispute has no refundable amount' });
        }
        const [row] = await db
          .update(disputes)
          .set({ status: 'refund_pending', resolution: note ?? null, handledBy })
          .where(eq(disputes.id, id))
          .returning();
        return { ok: true, dispute: serialize(row!) };
      }

      return reply.code(400).send({
        error: 'invalid_action',
        validActions: ['reject', 'approve_refund'],
      });
    },
  );

  // ── PUT /disputes/:id/refund ───────────────────────────────────────────────
  // Manage the refund payout from the Refund Queue. Moves the dispute through
  // refund_processing → refund_completed (terminal) or refund_failed.
  app.put<{ Params: { id: string }; Body: { status?: string; note?: string; ref?: string } }>(
    '/:id/refund',
    async (req, reply) => {
      const { id } = req.params;
      const { status, note, ref } = req.body ?? {};

      if (!status || !REFUND_TARGETS.includes(status as RefundTarget)) {
        return reply.code(400).send({ error: 'invalid_status', validStatuses: REFUND_TARGETS });
      }

      const dispute = await findDispute(id);
      if (!dispute) return reply.code(404).send({ error: 'dispute_not_found' });

      if (!QUEUE_STATUSES.refund.includes(dispute.status as never)) {
        return reply.code(409).send({
          error: 'not_in_refund_queue',
          message: 'Only disputes with an approved refund can be managed here',
        });
      }

      const [row] = await db
        .update(disputes)
        .set({
          status: status as RefundTarget,
          refundNote: note ?? dispute.refundNote,
          refundRef: ref ?? dispute.refundRef,
          handledBy: req.user?.id ?? dispute.handledBy,
          resolvedAt: status === 'refund_completed' ? new Date() : dispute.resolvedAt,
        })
        .where(eq(disputes.id, id))
        .returning();

      return { ok: true, dispute: serialize(row!) };
    },
  );
}

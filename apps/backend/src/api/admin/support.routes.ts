import type { FastifyInstance } from 'fastify';
import { desc, eq } from 'drizzle-orm';
import { db } from '../../config/db';
import { supportTickets } from '../../db/schema/safety-comm';
import { recordAuditSafe } from '../../modules/admin/audit';

// Statuses an admin may move a general help ticket into.
const VALID_STATUSES = ['open', 'in_progress', 'resolved', 'escalated'] as const;
type SupportStatus = (typeof VALID_STATUSES)[number];

type TicketRow = typeof supportTickets.$inferSelect;

// DB row → the shape the admin Support page (useSupportStore) renders.
function serialize(row: TicketRow) {
  return {
    id: row.id,
    subject: row.subject,
    // Help tickets are rider-raised this phase (driver support is a stub);
    // derive from the user's role once driver support ships.
    raisedBy: 'rider' as const,
    userId: row.userId,
    status: row.status,
    priority: row.priority,
    category: row.category,
    date: row.createdAt,
    assignedTo: row.handledBy,
    // Phase 1 is status-only — no reply thread yet.
    messages: 1,
  };
}

export async function routes(app: FastifyInstance) {
  // GET /api/v1/admin/support — every support ticket, newest first.
  app.get('/', async () => {
    const rows = await db
      .select()
      .from(supportTickets)
      .orderBy(desc(supportTickets.createdAt));
    return rows.map(serialize);
  });

  // PUT /api/v1/admin/support/:id — move a ticket to a new status.
  app.put<{ Params: { id: string }; Body: { status?: string } }>(
    '/:id',
    async (req, reply) => {
      const { id } = req.params;
      const { status } = req.body ?? {};

      if (!status || !VALID_STATUSES.includes(status as SupportStatus)) {
        return reply.code(400).send({ error: 'invalid_status', validStatuses: VALID_STATUSES });
      }

      const ticket = await db.query.supportTickets.findFirst({ where: eq(supportTickets.id, id) });
      if (!ticket) return reply.code(404).send({ error: 'ticket_not_found' });

      const [row] = await db
        .update(supportTickets)
        .set({
          status: status as SupportStatus,
          handledBy: req.user?.id ?? ticket.handledBy,
          resolvedAt: status === 'resolved' ? new Date() : ticket.resolvedAt,
        })
        .where(eq(supportTickets.id, id))
        .returning();

      await recordAuditSafe(req, {
        action: 'update_support_ticket',
        targetType: 'support_ticket',
        targetId: id,
        targetName: `Ticket #${id.slice(0, 8)}`,
        details: `Status → ${status}`,
        payload: { status },
      });

      return { ok: true, ticket: serialize(row!) };
    },
  );
}

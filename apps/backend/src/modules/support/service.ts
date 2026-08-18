import { desc, eq } from 'drizzle-orm';
import { db } from '../../db';
import { supportTickets } from '../../db/schema';

// General help-desk categories the rider can pick (mirrors the admin Support page).
type SupportCategory = (typeof supportTickets.category.enumValues)[number];

type CreateInput = {
  subject: string;
  category: SupportCategory;
  description: string;
  /** Optional trip the ticket references (stored in refId). Not a dispute. */
  tripId?: string;
};

// DB row → shared `SupportTicket` shape consumed by @teeko/api.
function toDto(row: typeof supportTickets.$inferSelect) {
  return {
    id: row.id,
    subject: row.subject,
    category: row.category,
    status: row.status,
    priority: row.priority,
    description: row.body,
    tripId: row.refId ?? undefined,
    createdAt: row.createdAt.toISOString(),
    resolvedAt: row.resolvedAt?.toISOString(),
  };
}

export const supportService = {
  // ---- rider: raise a general support ticket ----
  async create(userId: string, input: CreateInput) {
    const [row] = await db
      .insert(supportTickets)
      .values({
        userId,
        category: input.category,
        subject: input.subject,
        body: input.description,
        refId: input.tripId ?? null,
        // kind stays null (general help ticket, not a driver account action);
        // status defaults to 'open' and priority to 'medium'.
      })
      .returning();
    return toDto(row!);
  },

  // ---- rider: list every support ticket they've raised ----
  async listForRider(userId: string) {
    const rows = await db.query.supportTickets.findMany({
      where: eq(supportTickets.userId, userId),
      orderBy: [desc(supportTickets.createdAt)],
    });
    return rows.map(toDto);
  },
};

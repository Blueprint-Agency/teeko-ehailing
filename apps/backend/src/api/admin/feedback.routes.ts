import type { FastifyInstance } from 'fastify';
import { desc, eq } from 'drizzle-orm';
import { db } from '../../config/db';
import { feedback } from '../../db/schema/feedback-disputes';
import { users } from '../../db/schema/identity';

// ── Routes ────────────────────────────────────────────────────────────────────
export async function routes(app: FastifyInstance) {
  // ── GET /feedback ──────────────────────────────────────────────────────────
  // List all user feedback, newest first, with the submitter's name.
  app.get('/', async () => {
    const rows = await db
      .select({
        id: feedback.id,
        userId: feedback.userId,
        userName: users.fullName,
        tripId: feedback.tripId,
        role: feedback.role,
        category: feedback.category,
        rating: feedback.rating,
        message: feedback.message,
        createdAt: feedback.createdAt,
      })
      .from(feedback)
      .leftJoin(users, eq(users.id, feedback.userId))
      .orderBy(desc(feedback.createdAt));

    return rows.map((r) => ({
      id: r.id,
      userName: r.userName ?? '—',
      tripId: r.tripId ? r.tripId.slice(0, 8) : null,
      role: r.role,
      category: r.category,
      rating: r.rating,
      message: r.message,
      createdAt: r.createdAt,
    }));
  });
}

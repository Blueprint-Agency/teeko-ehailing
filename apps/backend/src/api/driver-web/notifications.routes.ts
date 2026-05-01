import type { FastifyInstance } from 'fastify';
import { eq, isNull } from 'drizzle-orm';
import { db } from '../../config/db';
import { notificationInbox } from '../../db/schema/notifications-content';

export async function routes(app: FastifyInstance) {
  app.get('/', async (req) => {
    const userId = req.user!.id;

    const rows = await db.query.notificationInbox.findMany({
      where: eq(notificationInbox.userId, userId),
      orderBy: (t, { desc }) => [desc(t.createdAt)],
    });

    return rows.map((n) => ({
      id: n.id,
      // deeplink stores the frontend notification type (doc_approved, doc_rejected, etc.)
      type: n.deeplink ?? 'evp_update',
      title: n.title,
      body: n.body,
      read: n.readAt !== null,
      createdAt: n.createdAt.toISOString(),
    }));
  });

  app.patch<{ Params: { id: string } }>('/:id/read', async (req, reply) => {
    const userId = req.user!.id;

    const notif = await db.query.notificationInbox.findFirst({
      where: eq(notificationInbox.id, req.params.id),
    });

    if (!notif || notif.userId !== userId) return reply.code(404).send({ error: 'not_found' });

    await db
      .update(notificationInbox)
      .set({ readAt: new Date() })
      .where(eq(notificationInbox.id, req.params.id));

    return { ok: true };
  });

  app.patch('/read-all', async (req) => {
    const userId = req.user!.id;

    await db
      .update(notificationInbox)
      .set({ readAt: new Date() })
      .where(eq(notificationInbox.userId, userId));

    return { ok: true };
  });
}

import type { FastifyInstance } from 'fastify';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../../config/db';
import { notificationInbox } from '../../db/schema/notifications-content';

export async function routes(app: FastifyInstance) {
  // GET /notifications — rider's full inbox, newest first.
  app.get('/', async (req, reply) => {
    if (!req.user) return reply.code(404).send({ error: 'profile_not_provisioned' });

    const rows = await db
      .select({
        id: notificationInbox.id,
        category: notificationInbox.category,
        title: notificationInbox.title,
        body: notificationInbox.body,
        deeplink: notificationInbox.deeplink,
        refId: notificationInbox.refId,
        createdAt: notificationInbox.createdAt,
        readAt: notificationInbox.readAt,
      })
      .from(notificationInbox)
      .where(eq(notificationInbox.userId, req.user.id))
      .orderBy(desc(notificationInbox.createdAt))
      .limit(100);

    return rows;
  });

  // PATCH /notifications/:id/read — mark one notification as read.
  app.patch('/:id/read', async (req, reply) => {
    if (!req.user) return reply.code(404).send({ error: 'profile_not_provisioned' });

    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);

    const updated = await db
      .update(notificationInbox)
      .set({ readAt: new Date() })
      .where(
        and(
          eq(notificationInbox.id, id),
          eq(notificationInbox.userId, req.user.id),
          isNull(notificationInbox.readAt),
        ),
      )
      .returning({ id: notificationInbox.id });

    if (updated.length === 0) {
      // Either not found or already read — both are fine for idempotency.
      return { ok: true };
    }
    return { ok: true };
  });

  // PATCH /notifications/read-all — bulk-mark everything unread as read.
  app.patch('/read-all', async (req, reply) => {
    if (!req.user) return reply.code(404).send({ error: 'profile_not_provisioned' });

    await db
      .update(notificationInbox)
      .set({ readAt: new Date() })
      .where(
        and(
          eq(notificationInbox.userId, req.user.id),
          isNull(notificationInbox.readAt),
        ),
      );

    return { ok: true };
  });
}

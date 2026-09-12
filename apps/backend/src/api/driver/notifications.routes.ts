import type { FastifyInstance } from 'fastify';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../../config/db';
import { notificationInbox } from '../../db/schema/notifications-content';

export async function routes(app: FastifyInstance) {
  // GET /notifications — driver's inbox (EVP, doc-expiry, payout, suspension,
  // incentive, broadcast), newest first.
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

  // PATCH /notifications/read-all — bulk-mark everything unread as read.
  // Registered before /:id/read so "read-all" is never parsed as an id.
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

  // PATCH /notifications/:id/read — mark one notification as read.
  app.patch('/:id/read', async (req, reply) => {
    if (!req.user) return reply.code(404).send({ error: 'profile_not_provisioned' });

    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);

    await db
      .update(notificationInbox)
      .set({ readAt: new Date() })
      .where(
        and(
          eq(notificationInbox.id, id),
          eq(notificationInbox.userId, req.user.id),
          isNull(notificationInbox.readAt),
        ),
      );

    // Not-found and already-read both answer ok — the call is idempotent.
    return { ok: true };
  });
}

import type { FastifyInstance } from 'fastify';
import { and, eq, isNull } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../../config/db';
import { users, userRoles } from '../../db/schema/identity';
import {
  broadcastMessages,
  broadcastRecipients,
  notificationInbox,
} from '../../db/schema/notifications-content';
import { trackingService } from '../../modules/tracking/service';

const BroadcastBody = z.object({
  segment: z.enum(['all_riders', 'all_drivers']),
  title: z.string().min(1).max(80),
  message: z.string().min(1).max(300),
});

export async function routes(app: FastifyInstance) {
  // GET /broadcasts — sent history.
  app.get('/', async () => {
    const rows = await db.query.broadcastMessages.findMany({
      orderBy: (t, { desc }) => [desc(t.createdAt)],
      limit: 100,
    });
    return rows.map((r) => ({
      id: r.id,
      segment: (r.segmentFilter as { segment: string })?.segment ?? 'all_riders',
      title: (r.payload as { title: string })?.title ?? '',
      message: (r.payload as { message: string })?.message ?? '',
      sentAt: r.sentAt?.toISOString() ?? r.createdAt.toISOString(),
      composedBy: r.composedBy,
    }));
  });

  // POST /broadcasts — compose and immediately fanout to segment.
  app.post('/', async (req) => {
    const { segment, title, message } = BroadcastBody.parse(req.body);

    // Determine the role targeted by this segment.
    const role = segment === 'all_riders' ? 'rider' : 'driver';

    // Resolve recipients: all active users with the target role.
    const recipientRows = await db
      .select({ id: users.id })
      .from(users)
      .innerJoin(
        userRoles,
        and(eq(userRoles.userId, users.id), eq(userRoles.role, role)),
      )
      .where(isNull(users.deletedAt));

    const now = new Date();
    const adminId = req.user?.id ?? '00000000-0000-0000-0000-0000000000a0';

    // Write the broadcast record.
    const [broadcast] = await db
      .insert(broadcastMessages)
      .values({
        composedBy: adminId,
        templateKey: 'admin_broadcast',
        segmentFilter: { segment },
        payload: { title, message },
        sentAt: now,
      })
      .returning({ id: broadcastMessages.id });

    if (recipientRows.length > 0 && broadcast) {
      // Fanout: one notification_inbox row per recipient + one broadcast_recipient row.
      const inboxValues = recipientRows.map((r) => ({
        userId: r.id,
        category: 'broadcast' as const,
        title,
        body: message,
        createdAt: now,
      }));

      const recipientValues = recipientRows.map((r) => ({
        broadcastId: broadcast.id,
        userId: r.id,
        deliveredAt: now,
      }));

      // Insert in chunks to stay well under the Postgres 65535-parameter limit.
      const CHUNK = 500;
      for (let i = 0; i < inboxValues.length; i += CHUNK) {
        await db.insert(notificationInbox).values(inboxValues.slice(i, i + CHUNK));
      }
      for (let i = 0; i < recipientValues.length; i += CHUNK) {
        await db.insert(broadcastRecipients).values(recipientValues.slice(i, i + CHUNK));
      }

      // Real-time socket emit to online users
      for (const r of recipientRows) {
        const notifPayload = {
          id: broadcast.id,
          category: 'broadcast',
          title,
          body: message,
          createdAt: now.toISOString(),
          readAt: null,
        };
        if (role === 'rider') {
          trackingService.emitToRider(r.id, 'notification.new', notifPayload);
        } else {
          trackingService.emitToDriver(r.id, 'notification.new', notifPayload);
        }
      }
    }

    return {
      ok: true,
      broadcastId: broadcast?.id ?? '',
      reach: recipientRows.length,
      sentAt: now.toISOString(),
    };
  });
}

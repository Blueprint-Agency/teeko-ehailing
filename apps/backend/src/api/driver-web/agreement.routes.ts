import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { db } from '../../config/db';
import { driverApplications } from '../../db/schema/onboarding';

export async function routes(app: FastifyInstance) {
  app.post('/accept', async (req, reply) => {
    const userId = req.user!.id;

    const application = await db.query.driverApplications.findFirst({
      where: eq(driverApplications.driverId, userId),
    });

    if (!application) {
      // Create the application record and advance to agreement_signed
      await db.insert(driverApplications).values({
        driverId: userId,
        state: 'agreement_signed',
      });
    } else if (application.state === 'phone_entered') {
      await db
        .update(driverApplications)
        .set({ state: 'agreement_signed', updatedAt: new Date() })
        .where(eq(driverApplications.driverId, userId));
    }

    return { ok: true };
  });
}

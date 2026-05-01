import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { db } from '../../config/db';
import { driverApplications } from '../../db/schema/onboarding';

const stateToStep: Record<string, number> = {
  phone_entered: 0,
  agreement_signed: 1,
  personal_docs_submitted: 2,
  vehicle_added: 3,
  vehicle_docs_submitted: 4,
  in_review: 4,
  rejected: 4,
  activated: 4,
};

export async function routes(app: FastifyInstance) {
  app.get('/', async (req, reply) => {
    const userId = req.user!.id;

    const application = await db.query.driverApplications.findFirst({
      where: eq(driverApplications.driverId, userId),
    });

    if (!application) {
      // No application yet — driver is at step 0
      return { state: 'phone_entered', currentStep: 0 };
    }

    return {
      state: application.state,
      currentStep: stateToStep[application.state] ?? 0,
      rejectionReason: application.rejectionReason ?? null,
    };
  });
}

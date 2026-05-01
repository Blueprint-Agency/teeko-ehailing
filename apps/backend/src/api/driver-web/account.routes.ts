import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { db } from '../../config/db';
import { users } from '../../db/schema/identity';
import { driverApplications } from '../../db/schema/onboarding';

export async function routes(app: FastifyInstance) {
  app.get('/', async (req, reply) => {
    const userId = req.user!.id;

    const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
    if (!user) return reply.code(404).send({ error: 'not_found' });

    const application = await db.query.driverApplications.findFirst({
      where: eq(driverApplications.driverId, userId),
    });

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

    return {
      id: user.id,
      fullName: user.fullName ?? '',
      phone: user.phone,
      email: user.email ?? '',
      onboardingStep: application ? (stateToStep[application.state] ?? 0) : 0,
      agreementAccepted: application
        ? ['agreement_signed', 'personal_docs_submitted', 'vehicle_added', 'vehicle_docs_submitted', 'in_review', 'rejected', 'activated'].includes(application.state)
        : false,
      agreementTimestamp: application?.updatedAt?.toISOString() ?? null,
    };
  });
}

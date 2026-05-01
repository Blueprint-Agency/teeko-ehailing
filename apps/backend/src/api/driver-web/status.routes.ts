import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { db } from '../../config/db';
import { driverApplications } from '../../db/schema/onboarding';

type ReviewStageStatus = 'pending' | 'in_progress' | 'approved' | 'rejected';
type EVPStatus = 'not_started' | 'submitted' | 'approved' | 'rejected';
type AccountStatus = 'pending_activation' | 'active' | 'suspended';

function stateToStatus(state: string): {
  docReview: ReviewStageStatus;
  evpApplication: EVPStatus;
  accountStatus: AccountStatus;
} {
  switch (state) {
    case 'activated':
      return { docReview: 'approved', evpApplication: 'approved', accountStatus: 'active' };
    case 'in_review':
      return { docReview: 'in_progress', evpApplication: 'not_started', accountStatus: 'pending_activation' };
    case 'rejected':
      return { docReview: 'rejected', evpApplication: 'not_started', accountStatus: 'pending_activation' };
    case 'vehicle_docs_submitted':
      return { docReview: 'pending', evpApplication: 'not_started', accountStatus: 'pending_activation' };
    default:
      return { docReview: 'pending', evpApplication: 'not_started', accountStatus: 'pending_activation' };
  }
}

export async function routes(app: FastifyInstance) {
  app.get('/', async (req, reply) => {
    const userId = req.user!.id;

    const application = await db.query.driverApplications.findFirst({
      where: eq(driverApplications.driverId, userId),
    });

    if (!application) return reply.code(404).send({ error: 'not_found' });

    const { docReview, evpApplication, accountStatus } = stateToStatus(application.state);

    return {
      docReview,
      evpApplication,
      evpBody: null,
      evpSubmittedDate: null,
      accountStatus,
      activatedDate: application.approvedAt?.toISOString() ?? null,
    };
  });
}

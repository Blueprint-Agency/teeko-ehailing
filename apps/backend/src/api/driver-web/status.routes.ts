import type { FastifyInstance } from 'fastify';
import { and, eq, or } from 'drizzle-orm';
import { db } from '../../config/db';
import { documents, documentReviews, driverApplications } from '../../db/schema/onboarding';
import { vehicles } from '../../db/schema/drivers';
import { evpRecords } from '../../db/schema/compliance';

type ReviewStageStatus = 'pending' | 'in_progress' | 'approved' | 'rejected';
type EVPStatus = 'not_started' | 'submitted' | 'approved' | 'rejected';
type AccountStatus = 'pending_activation' | 'active' | 'suspended';

const REQUIRED_PERSONAL = ['nric_front', 'nric_back', 'cdl', 'psv_d', 'insurance', 'driver_selfie'];
const REQUIRED_VEHICLE = ['car_grant', 'road_tax', 'puspakom', 'insurance'];

function computeDocReview(
  rows: { ownerKind: string; kind: string; reviewStatus: string | null }[],
): ReviewStageStatus {
  if (rows.length === 0) return 'pending';
  if (rows.some((r) => r.reviewStatus === 'rejected')) return 'rejected';

  const approvedDriver = new Set(
    rows.filter((r) => r.ownerKind === 'driver' && r.reviewStatus === 'approved').map((r) => r.kind),
  );
  const approvedVehicle = new Set(
    rows.filter((r) => r.ownerKind === 'vehicle' && r.reviewStatus === 'approved').map((r) => r.kind),
  );
  const allRequiredApproved =
    REQUIRED_PERSONAL.every((k) => approvedDriver.has(k)) &&
    REQUIRED_VEHICLE.every((k) => approvedVehicle.has(k));

  if (allRequiredApproved) return 'approved';
  return 'in_progress';
}

function computeEvpStatus(recordStatus: string | null | undefined): EVPStatus {
  switch (recordStatus) {
    case 'approved':
      return 'approved';
    case 'rejected':
    case 'expired':
      return 'rejected';
    case 'pending':
      return 'submitted';
    default:
      return 'not_started';
  }
}

export async function routes(app: FastifyInstance) {
  app.get('/', async (req, reply) => {
    const userId = req.user!.id;

    const application = await db.query.driverApplications.findFirst({
      where: eq(driverApplications.driverId, userId),
    });

    if (!application) return reply.code(404).send({ error: 'not_found' });

    const vehicle = await db.query.vehicles.findFirst({
      where: eq(vehicles.driverId, userId),
    });

    const ownerConditions = [and(eq(documents.ownerKind, 'driver'), eq(documents.ownerId, userId))];
    if (vehicle) {
      ownerConditions.push(and(eq(documents.ownerKind, 'vehicle'), eq(documents.ownerId, vehicle.id)));
    }

    const docRows = await db
      .select({
        ownerKind: documents.ownerKind,
        kind: documents.kind,
        reviewStatus: documentReviews.status,
      })
      .from(documents)
      .leftJoin(documentReviews, eq(documentReviews.documentId, documents.id))
      .where(or(...ownerConditions));

    const evp = await db.query.evpRecords.findFirst({
      where: eq(evpRecords.driverId, userId),
      orderBy: (t, { desc }) => [desc(t.submittedAt)],
    });

    const docReview = computeDocReview(docRows);
    const evpApplication = computeEvpStatus(evp?.status);
    const accountStatus: AccountStatus =
      application.state === 'activated' ? 'active' : 'pending_activation';

    return {
      docReview,
      evpApplication,
      evpBody: evp ? (evp.authority === 'apad' ? 'APAD' : 'LPKP') : null,
      evpSubmittedDate: evp?.submittedAt?.toISOString() ?? null,
      accountStatus,
      activatedDate: application.approvedAt?.toISOString() ?? evp?.approvedAt?.toISOString() ?? null,
    };
  });
}

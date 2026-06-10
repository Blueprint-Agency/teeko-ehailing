import type { FastifyInstance } from 'fastify';
import { and, eq, inArray } from 'drizzle-orm';
import { db } from '../../config/db';
import { documents, documentReviews, driverApplications } from '../../db/schema/onboarding';
import { vehicles } from '../../db/schema/drivers';
import { notificationInbox } from '../../db/schema/notifications-content';

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

const REQUIRED_PERSONAL = ['nric_front', 'nric_back', 'cdl', 'psv_d', 'insurance', 'driver_selfie'] as const;
const REQUIRED_VEHICLE = ['car_grant', 'road_tax', 'puspakom', 'insurance'] as const;

const SUBMITTED_STATES = new Set(['in_review', 'rejected', 'activated']);

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

  app.post('/submit', async (req, reply) => {
    const userId = req.user!.id;

    const application = await db.query.driverApplications.findFirst({
      where: eq(driverApplications.driverId, userId),
    });

    if (!application) return reply.code(404).send({ error: 'application_not_found' });

    if (SUBMITTED_STATES.has(application.state)) {
      return { ok: true, state: application.state, submittedAt: application.submittedAt?.toISOString() ?? null };
    }

    const vehicle = await db.query.vehicles.findFirst({
      where: eq(vehicles.driverId, userId),
    });
    if (!vehicle) return reply.code(400).send({ error: 'no_vehicle' });

    const [personalDocs, vehicleDocs] = await Promise.all([
      db.query.documents.findMany({
        where: and(eq(documents.ownerKind, 'driver'), eq(documents.ownerId, userId)),
      }),
      db.query.documents.findMany({
        where: and(eq(documents.ownerKind, 'vehicle'), eq(documents.ownerId, vehicle.id)),
      }),
    ]);

    const personalKinds = new Set(personalDocs.map((d) => d.kind));
    const vehicleKinds = new Set(vehicleDocs.map((d) => d.kind));

    const missingPersonal = REQUIRED_PERSONAL.filter((k) => !personalKinds.has(k as never));
    const missingVehicle = REQUIRED_VEHICLE.filter((k) => !vehicleKinds.has(k as never));

    if (missingPersonal.length > 0 || missingVehicle.length > 0) {
      return reply.code(400).send({
        error: 'incomplete_documents',
        missing: { personal: missingPersonal, vehicle: missingVehicle },
      });
    }

    const allDocIds = [...personalDocs, ...vehicleDocs].map((d) => d.id);
    const existingReviews = await db.query.documentReviews.findMany({
      where: inArray(documentReviews.documentId, allDocIds),
    });
    const reviewedDocIds = new Set(existingReviews.map((r) => r.documentId));
    const missingReviewDocIds = allDocIds.filter((id) => !reviewedDocIds.has(id));

    const now = new Date();

    await db.transaction(async (tx) => {
      if (missingReviewDocIds.length > 0) {
        await tx
          .insert(documentReviews)
          .values(missingReviewDocIds.map((documentId) => ({ documentId, status: 'pending' as const })));
      }

      await tx
        .update(driverApplications)
        .set({ state: 'in_review', submittedAt: now, updatedAt: now })
        .where(eq(driverApplications.driverId, userId));

      await tx.insert(notificationInbox).values({
        userId,
        category: 'evp',
        title: 'Application submitted',
        body: 'Your documents are now under review. We will notify you once verification is complete.',
        deeplink: 'evp_update',
      });
    });

    return { ok: true, state: 'in_review', submittedAt: now.toISOString() };
  });
}

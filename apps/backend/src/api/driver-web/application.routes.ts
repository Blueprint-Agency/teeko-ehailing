import type { FastifyInstance } from 'fastify';
import { randomUUID } from 'node:crypto';
import { extname } from 'node:path';
import { and, eq, inArray } from 'drizzle-orm';
import { db } from '../../config/db';
import { documents, documentReviews, driverApplications } from '../../db/schema/onboarding';
import { vehicles } from '../../db/schema/drivers';
import { notificationInbox } from '../../db/schema/notifications-content';
import { storage } from '../../lib/storage';

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

  // Batch onboarding submit (multipart/form-data).
  // The web onboarding flow holds all data client-side and submits everything
  // in one shot here: vehicle details (JSON field "vehicle") + all required
  // document files (one file part per frontend doc id). Files are saved to
  // storage first, then a single DB transaction commits the vehicle, documents,
  // reviews, application state, and notification atomically.
  app.post('/onboard', async (req, reply) => {
    const userId = req.user!.id;

    const application = await db.query.driverApplications.findFirst({
      where: eq(driverApplications.driverId, userId),
    });
    if (!application) return reply.code(404).send({ error: 'application_not_found' });

    // Idempotent: if already submitted, don't create duplicates.
    if (SUBMITTED_STATES.has(application.state)) {
      return { ok: true, state: application.state, submittedAt: application.submittedAt?.toISOString() ?? null };
    }

    // Map a frontend doc id to its DB kind + owner kind.
    const dbKindMap: Record<string, string> = { selfie: 'driver_selfie', vehicle_insurance: 'insurance' };
    const VEHICLE_DOC_IDS = ['car_grant', 'road_tax', 'puspakom', 'vehicle_insurance'];
    const REQUIRED_PERSONAL_IDS = ['nric_front', 'nric_back', 'cdl', 'psv_d', 'insurance', 'selfie'];
    const REQUIRED_VEHICLE_IDS = ['car_grant', 'road_tax', 'puspakom', 'vehicle_insurance'];

    // Parse multipart parts: collect vehicle JSON + file buffers keyed by field name.
    const files = new Map<string, { buffer: Buffer; mimetype: string; filename: string }>();
    let vehiclePayload: {
      plateNumber?: string;
      make?: string;
      model?: string;
      year?: number;
      colour?: string;
      category?: 'go' | 'comfort' | 'xl' | 'premium' | 'bike';
    } | null = null;

    try {
      for await (const part of (req as any).parts()) {
        if (part.type === 'file') {
          files.set(part.fieldname, {
            buffer: await part.toBuffer(),
            mimetype: part.mimetype,
            filename: part.filename,
          });
        } else if (part.fieldname === 'vehicle') {
          vehiclePayload = JSON.parse(part.value);
        }
      }
    } catch (err) {
      req.log.error({ err }, 'failed to parse onboarding multipart');
      return reply.code(400).send({ error: 'invalid_payload' });
    }

    // Validate vehicle details.
    if (
      !vehiclePayload ||
      !vehiclePayload.plateNumber ||
      !vehiclePayload.make ||
      !vehiclePayload.model ||
      !vehiclePayload.year
    ) {
      return reply.code(400).send({ error: 'invalid_vehicle' });
    }

    // Validate document completeness.
    const missingPersonal = REQUIRED_PERSONAL_IDS.filter((id) => !files.has(id));
    const missingVehicle = REQUIRED_VEHICLE_IDS.filter((id) => !files.has(id));
    if (missingPersonal.length > 0 || missingVehicle.length > 0) {
      return reply.code(400).send({
        error: 'incomplete_documents',
        missing: { personal: missingPersonal, vehicle: missingVehicle },
      });
    }

    // Pre-generate the vehicle id so vehicle-doc storage paths and documents.ownerId align.
    const vehicleId = randomUUID();

    // Save all files to storage first (outside the txn). Orphaned blobs are
    // harmless if the txn later fails — no DB row references them.
    const docRows: { ownerKind: 'driver' | 'vehicle'; ownerId: string; kind: string; gcsPath: string; mimeType: string }[] = [];
    try {
      for (const [frontendId, file] of files) {
        const dbKind = dbKindMap[frontendId] ?? frontendId;
        const isVehicleDoc = VEHICLE_DOC_IDS.includes(frontendId);
        const ownerKind = isVehicleDoc ? 'vehicle' : 'driver';
        const ownerId = isVehicleDoc ? vehicleId : userId;
        const ext = extname(file.filename || '') || '.bin';
        const gcsPath = await storage.save(`drivers/${ownerId}/${dbKind}${ext}`, file.buffer, file.mimetype);
        docRows.push({ ownerKind, ownerId, kind: dbKind, gcsPath, mimeType: file.mimetype });
      }
    } catch (err) {
      req.log.error({ err }, 'onboarding file upload failed');
      return reply.code(500).send({ error: 'upload_failed' });
    }

    const now = new Date();

    try {
      await db.transaction(async (tx) => {
        await tx.insert(vehicles).values({
          id: vehicleId,
          driverId: userId,
          plateNumber: vehiclePayload!.plateNumber!,
          make: vehiclePayload!.make!,
          model: vehiclePayload!.model!,
          year: Number(vehiclePayload!.year),
          colour: vehiclePayload!.colour,
          category: vehiclePayload!.category ?? 'go',
        });

        const inserted = await tx
          .insert(documents)
          .values(
            docRows.map((d) => ({
              ownerKind: d.ownerKind,
              ownerId: d.ownerId,
              kind: d.kind as never,
              gcsPath: d.gcsPath,
              mimeType: d.mimeType,
            })),
          )
          .returning({ id: documents.id });

        await tx
          .insert(documentReviews)
          .values(inserted.map((row) => ({ documentId: row.id, status: 'pending' as const })));

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
    } catch (err) {
      req.log.error({ err }, 'onboarding submit transaction failed');
      return reply.code(500).send({ error: 'submit_failed' });
    }

    return { ok: true, state: 'in_review', submittedAt: now.toISOString() };
  });
}

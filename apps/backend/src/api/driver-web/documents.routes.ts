import type { FastifyInstance } from 'fastify';
import { extname } from 'node:path';
import { and, eq } from 'drizzle-orm';
import { db } from '../../config/db';
import { documents, documentReviews } from '../../db/schema/onboarding';
import { vehicles } from '../../db/schema/drivers';
import { storage } from '../../lib/storage';

// Map DB document kind + ownerKind to the frontend DocumentState.id
function toFrontendId(kind: string, ownerKind: string): string {
  if (kind === 'driver_selfie') return 'selfie';
  if (kind === 'insurance' && ownerKind === 'vehicle') return 'vehicle_insurance';
  return kind;
}

// Map DB review status + document existence to frontend DocumentStatus
function toFrontendStatus(reviewStatus: string | null): string {
  if (!reviewStatus) return 'uploaded';
  if (reviewStatus === 'approved') return 'approved';
  if (reviewStatus === 'rejected') return 'rejected';
  return 'under_review'; // pending
}

const PERSONAL_DOC_LABELS: Record<string, string> = {
  nric_front: 'NRIC / MyKad (Front)',
  nric_back: 'NRIC / MyKad (Back)',
  cdl: 'Competent Driving Licence (CDL)',
  psv_d: 'PSV-D Licence (E-hailing Licence)',
  insurance: 'E-hailing Insurance Cover Note',
  selfie: 'Profile Photo / Liveness Selfie',
};

const VEHICLE_DOC_LABELS: Record<string, string> = {
  car_grant: 'Car Grant / VOC',
  road_tax: 'Road Tax',
  vehicle_insurance: 'E-hailing Insurance Cover Note',
  puspakom: 'PUSPAKOM Inspection Certificate',
};

async function fetchDocs(ownerKind: 'driver' | 'vehicle', ownerId: string) {
  const rows = await db
    .select({
      id: documents.id,
      kind: documents.kind,
      ownerKind: documents.ownerKind,
      gcsPath: documents.gcsPath,
      uploadedAt: documents.uploadedAt,
      reviewStatus: documentReviews.status,
      reviewReason: documentReviews.reason,
      reviewedAt: documentReviews.reviewedAt,
    })
    .from(documents)
    .leftJoin(documentReviews, eq(documentReviews.documentId, documents.id))
    .where(and(eq(documents.ownerKind, ownerKind), eq(documents.ownerId, ownerId)));

  return rows.map((r) => {
    const frontendId = toFrontendId(r.kind, r.ownerKind);
    const labels = ownerKind === 'driver' ? PERSONAL_DOC_LABELS : VEHICLE_DOC_LABELS;
    return {
      id: frontendId,
      label: labels[frontendId] ?? frontendId,
      status: toFrontendStatus(r.reviewStatus ?? null),
      fileUrl: r.gcsPath,
      rejectionReason: r.reviewReason ?? undefined,
      uploadedAt: r.uploadedAt?.toISOString() ?? null,
      reviewedAt: r.reviewedAt?.toISOString() ?? null,
    };
  });
}

export async function routes(app: FastifyInstance) {
  app.get('/', async (req, reply) => {
    const userId = req.user!.id;

    // Get active vehicle for vehicle doc lookup
    const vehicle = await db.query.vehicles.findFirst({
      where: eq(vehicles.driverId, userId),
    });

    const [personal, vehicle_docs] = await Promise.all([
      fetchDocs('driver', userId),
      vehicle ? fetchDocs('vehicle', vehicle.id) : Promise.resolve([]),
    ]);

    return { personal, vehicle: vehicle_docs };
  });

  // Upload a document file (multipart/form-data, field name: "file")
  // Requires @fastify/multipart registered on the app instance
  app.post<{ Params: { kind: string } }>('/:kind/upload', async (req, reply) => {
    const userId = req.user!.id;
    const { kind: frontendKind } = req.params;

    const kindMap: Record<string, string> = {
      selfie: 'driver_selfie',
      vehicle_insurance: 'insurance',
    };
    const dbKind = kindMap[frontendKind] ?? frontendKind;

    const vehicleKinds = ['car_grant', 'road_tax', 'puspakom', 'insurance'];
    const ownerKind = vehicleKinds.includes(dbKind) ? 'vehicle' : 'driver';

    let ownerId = userId;
    if (ownerKind === 'vehicle') {
      const vehicle = await db.query.vehicles.findFirst({ where: eq(vehicles.driverId, userId) });
      if (!vehicle) return reply.code(404).send({ error: 'no_vehicle' });
      ownerId = vehicle.id;
    }

    const data = await (req as any).file();
    if (!data) return reply.code(400).send({ error: 'No file uploaded' });

    const buffer: Buffer = await data.toBuffer();
    const ext = extname(data.filename || '') || '.bin';
    const filePath = `drivers/${ownerId}/${dbKind}${ext}`;
    const url = await storage.save(filePath, buffer, data.mimetype);

    // Upsert document record
    const existing = await db.query.documents.findFirst({
      where: and(
        eq(documents.ownerKind, ownerKind as 'driver' | 'vehicle'),
        eq(documents.ownerId, ownerId),
        eq(documents.kind, dbKind as never),
      ),
    });

    if (existing) {
      await db
        .update(documents)
        .set({ gcsPath: url, mimeType: data.mimetype, uploadedAt: new Date() })
        .where(eq(documents.id, existing.id));
    } else {
      await db.insert(documents).values({
        ownerKind: ownerKind as 'driver' | 'vehicle',
        ownerId,
        kind: dbKind as never,
        gcsPath: url,
        mimeType: data.mimetype,
      });
    }

    return { url };
  });

  // Resubmit a rejected/uploaded document (v0.1: marks as uploaded, no real GCS)
  app.post<{ Params: { id: string }; Body: { fileName?: string } }>(
    '/:id/resubmit',
    async (req, reply) => {
      const userId = req.user!.id;
      const { id: frontendId } = req.params;

      // Map frontend id back to DB kind
      const kindMap: Record<string, string> = {
        selfie: 'driver_selfie',
        vehicle_insurance: 'insurance',
      };
      const dbKind = kindMap[frontendId] ?? frontendId;

      // Determine ownerKind from the kind
      const vehicleKinds = ['car_grant', 'road_tax', 'puspakom', 'insurance'];
      const ownerKind = vehicleKinds.includes(dbKind) ? 'vehicle' : 'driver';

      let ownerId = userId;
      if (ownerKind === 'vehicle') {
        const vehicle = await db.query.vehicles.findFirst({ where: eq(vehicles.driverId, userId) });
        if (!vehicle) return reply.code(404).send({ error: 'no_vehicle' });
        ownerId = vehicle.id;
      }

      // Find existing document
      const doc = await db.query.documents.findFirst({
        where: and(
          eq(documents.ownerKind, ownerKind as 'driver' | 'vehicle'),
          eq(documents.ownerId, ownerId),
          eq(documents.kind, dbKind as never),
        ),
      });

      if (!doc) return reply.code(404).send({ error: 'document_not_found' });

      // Reset the review to pending
      await db
        .update(documentReviews)
        .set({ status: 'pending', reason: null, reviewedAt: null })
        .where(eq(documentReviews.documentId, doc.id));

      return { ok: true };
    }
  );
}

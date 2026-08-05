import type { FastifyInstance } from 'fastify';
import { and, eq } from 'drizzle-orm';

import { db } from '../../config/db';
import { vehicles } from '../../db/schema/drivers';
import { documents, documentReviews } from '../../db/schema/onboarding';

// Documents the driver app shows for a vehicle, in display order.
const VEHICLE_DOC_KINDS = ['car_grant', 'road_tax', 'insurance', 'puspakom'] as const;

const EXPIRING_SOON_DAYS = 30;

type DocStatus = 'approved' | 'pending' | 'rejected' | 'expiring_soon' | 'expired' | 'missing';

/**
 * An approved document that is past — or close to — its expiry is not really
 * "valid" to a driver, so expiry outranks the review status in what we report.
 */
function docStatus(
  review: string | null,
  expiry: string | null,
  today: Date,
): DocStatus {
  if (!review) return 'missing';
  if (review !== 'approved') return review as DocStatus;
  if (!expiry) return 'approved';
  const days = (new Date(expiry).getTime() - today.getTime()) / 86_400_000;
  if (days < 0) return 'expired';
  if (days <= EXPIRING_SOON_DAYS) return 'expiring_soon';
  return 'approved';
}

export async function routes(app: FastifyInstance) {
  // GET /api/v1/driver/vehicle — the driver's single registered vehicle and the
  // status of its documents. Returns null when onboarding hasn't added one yet.
  app.get('/vehicle', async (req, reply) => {
    if (!req.user) return reply.code(401).send({ error: 'unauthorized' });

    const v = await db.query.vehicles.findFirst({ where: eq(vehicles.driverId, req.user.id) });
    if (!v) return { vehicle: null };

    const rows = await db
      .select({
        kind: documents.kind,
        expiryDate: documents.expiryDate,
        uploadedAt: documents.uploadedAt,
        review: documentReviews.status,
      })
      .from(documents)
      .leftJoin(documentReviews, eq(documentReviews.documentId, documents.id))
      .where(and(eq(documents.ownerKind, 'vehicle'), eq(documents.ownerId, v.id)));

    // A re-upload leaves the old row in place, so keep the newest per kind.
    const latest = new Map<string, (typeof rows)[number]>();
    for (const row of rows) {
      const prev = latest.get(row.kind);
      if (!prev || row.uploadedAt > prev.uploadedAt) latest.set(row.kind, row);
    }

    const today = new Date();
    const docs = VEHICLE_DOC_KINDS.map((kind) => {
      const row = latest.get(kind);
      return {
        kind,
        status: docStatus(row?.review ?? null, row?.expiryDate ?? null, today),
        expiry: row?.expiryDate ?? null,
      };
    });

    return {
      vehicle: {
        id: v.id,
        plateNumber: v.plateNumber,
        make: v.make,
        model: v.model,
        year: v.year,
        colour: v.colour,
        category: v.category,
        documents: docs,
      },
    };
  });
}

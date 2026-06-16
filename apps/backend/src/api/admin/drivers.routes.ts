import type { FastifyInstance } from 'fastify';
import { and, desc, eq, sql } from 'drizzle-orm';
import { db } from '../../config/db';
import { documents, documentReviews, driverApplications } from '../../db/schema/onboarding';
import { vehicles, driverProfiles } from '../../db/schema/drivers';
import { evpRecords } from '../../db/schema/compliance';
import { users } from '../../db/schema/identity';
import { notificationInbox } from '../../db/schema/notifications-content';
import { ensureEvpRecordForDriver, resolveDocumentDriverId } from '../../modules/onboarding';

const DOC_LABELS: Record<string, string> = {
  nric_front: 'NRIC / MyKad (Front)',
  nric_back: 'NRIC / MyKad (Back)',
  cdl: 'Competent Driving Licence',
  psv_d: 'PSV-D Licence',
  driver_selfie: 'Profile Photo / Selfie',
  car_grant: 'Car Grant / VOC',
  road_tax: 'Road Tax',
  puspakom: 'PUSPAKOM Inspection',
  insurance: 'E-hailing Insurance',
};

export async function routes(app: FastifyInstance) {
  app.get('/documents', async () => {
    const docDriverId = sql<string>`coalesce(${vehicles.driverId}, ${documents.ownerId})`;

    const rows = await db
      .select({
        documentId: documents.id,
        kind: documents.kind,
        uploadedAt: documents.uploadedAt,
        reviewStatus: documentReviews.status,
        reviewedAt: documentReviews.reviewedAt,
        driverId: docDriverId,
        driverName: users.fullName,
        vehicleCategory: vehicles.category,
      })
      .from(documents)
      .leftJoin(documentReviews, eq(documentReviews.documentId, documents.id))
      .leftJoin(
        vehicles,
        and(eq(documents.ownerKind, 'vehicle'), eq(vehicles.id, documents.ownerId)),
      )
      .leftJoin(users, eq(users.id, docDriverId))
      .orderBy(desc(documents.uploadedAt));

    const byDocument = new Map<string, (typeof rows)[number]>();
    for (const r of rows) {
      const existing = byDocument.get(r.documentId);
      if (!existing || (r.reviewedAt?.getTime() ?? 0) > (existing.reviewedAt?.getTime() ?? 0)) {
        byDocument.set(r.documentId, r);
      }
    }

    return [...byDocument.values()].map((r) => ({
      documentId: r.documentId,
      driverId: r.driverId,
      driverName: r.driverName ?? '—',
      docType: DOC_LABELS[r.kind] ?? r.kind,
      category: r.vehicleCategory ?? '—',
      uploadedAt: r.uploadedAt?.toISOString() ?? null,
      status: r.reviewStatus ?? 'pending',
    }));
  });

  app.post<{ Params: { documentId: string }; Body: { status: 'approved' | 'rejected'; reason?: string } }>(
    '/documents/:documentId/review',
    async (req, reply) => {
      const reviewerId = req.user!.id;
      const { documentId } = req.params;
      const { status, reason } = req.body ?? ({} as { status?: string; reason?: string });

      if (status !== 'approved' && status !== 'rejected') {
        return reply.code(400).send({ error: 'invalid_status' });
      }
      if (status === 'rejected' && !reason) {
        return reply.code(400).send({ error: 'reason_required' });
      }

      const doc = await db.query.documents.findFirst({ where: eq(documents.id, documentId) });
      if (!doc) return reply.code(404).send({ error: 'document_not_found' });

      const now = new Date();
      let evpCreated = false;

      const driverId = await db.transaction(async (tx) => {
        const existingReview = await tx.query.documentReviews.findFirst({
          where: eq(documentReviews.documentId, documentId),
        });
        if (existingReview) {
          await tx
            .update(documentReviews)
            .set({ status, reason: status === 'rejected' ? reason! : null, reviewerId, reviewedAt: now })
            .where(eq(documentReviews.documentId, documentId));
        } else {
          await tx.insert(documentReviews).values({
            documentId,
            status,
            reason: status === 'rejected' ? reason! : null,
            reviewerId,
            reviewedAt: now,
          });
        }

        const resolvedDriverId = await resolveDocumentDriverId(tx, doc);
        if (status === 'approved' && resolvedDriverId) {
          evpCreated = await ensureEvpRecordForDriver(tx, resolvedDriverId);
          if (evpCreated) {
            await tx.insert(notificationInbox).values({
              userId: resolvedDriverId,
              category: 'evp',
              title: 'Documents verified',
              body: 'All your documents have been approved. Your e-hailing vehicle permit application is being prepared.',
              deeplink: 'evp_update',
            });
          }
        }
        return resolvedDriverId;
      });

      return { ok: true, evpCreated, driverId };
    },
  );

  // ── EVP application tracker ──────────────────────────────────────────────
  app.get('/evp', async () => {
    const rows = await db
      .select({
        id: evpRecords.id,
        driverId: evpRecords.driverId,
        name: users.fullName,
        region: evpRecords.region,
        authority: evpRecords.authority,
        status: evpRecords.status,
        applicationNo: evpRecords.applicationNo,
        expiryDate: evpRecords.expiryDate,
        submittedAt: evpRecords.submittedAt,
        category: vehicles.category,
        trips: driverProfiles.totalTrips,
        joinDate: users.createdAt,
        appState: driverApplications.state,
      })
      .from(evpRecords)
      .leftJoin(users, eq(users.id, evpRecords.driverId))
      .leftJoin(vehicles, eq(vehicles.id, evpRecords.vehicleId))
      .leftJoin(driverProfiles, eq(driverProfiles.userId, evpRecords.driverId))
      .leftJoin(driverApplications, eq(driverApplications.driverId, evpRecords.driverId))
      .orderBy(desc(users.createdAt));

    return rows.map((r) => ({
      id: r.id,
      driverId: r.driverId,
      name: r.name ?? '—',
      region: r.region,
      category: r.category ?? '—',
      evp: r.status,
      applicationNo: r.applicationNo ?? null,
      evpExpiry: r.expiryDate ?? null,
      trips: r.trips ?? 0,
      joinDate: r.joinDate ? r.joinDate.toISOString().slice(0, 10) : null,
      // The account is "open" once the application has been activated.
      account: r.appState === 'activated' ? 'open' : 'closed',
    }));
  });

  const EVP_STATUSES = ['not_applied', 'pending', 'approved', 'rejected', 'expired'] as const;
  type EvpStatus = (typeof EVP_STATUSES)[number];

  const EVP_NOTICE: Partial<Record<EvpStatus, { title: string; body: string }>> = {
    pending: {
      title: 'EVP application submitted',
      body: 'Your e-hailing vehicle permit application has been submitted to the authority and is pending approval.',
    },
    approved: {
      title: 'EVP application approved',
      body: 'Your e-hailing vehicle permit has been approved. Your account will be activated shortly.',
    },
    rejected: {
      title: 'EVP application rejected',
      body: 'Your e-hailing vehicle permit application was rejected. Please contact support for next steps.',
    },
    expired: {
      title: 'EVP permit expired',
      body: 'Your e-hailing vehicle permit has expired. Please renew it to continue driving.',
    },
  };

  app.post<{ Params: { recordId: string }; Body: { status?: string } }>(
    '/evp/:recordId/status',
    async (req, reply) => {
      const { recordId } = req.params;
      const { status } = req.body ?? {};

      if (!status || !EVP_STATUSES.includes(status as EvpStatus)) {
        return reply.code(400).send({ error: 'invalid_status' });
      }
      const next = status as EvpStatus;

      const record = await db.query.evpRecords.findFirst({ where: eq(evpRecords.id, recordId) });
      if (!record) return reply.code(404).send({ error: 'evp_record_not_found' });

      const now = new Date();
      const patch: Partial<typeof evpRecords.$inferInsert> = { status: next };
      // Stamp the lifecycle timestamps the driver-web status view reads.
      if (next === 'pending' && !record.submittedAt) patch.submittedAt = now;
      if (next === 'approved') patch.approvedAt = now;

      await db.transaction(async (tx) => {
        await tx.update(evpRecords).set(patch).where(eq(evpRecords.id, recordId));

        const notice = EVP_NOTICE[next];
        if (notice && next !== record.status) {
          await tx.insert(notificationInbox).values({
            userId: record.driverId,
            category: 'evp',
            title: notice.title,
            body: notice.body,
            deeplink: 'evp_update',
          });
        }
      });

      return { ok: true, status: next };
    },
  );

  app.post<{ Params: { recordId: string } }>(
    '/evp/:recordId/open-account',
    async (req, reply) => {
      const { recordId } = req.params;

      const record = await db.query.evpRecords.findFirst({ where: eq(evpRecords.id, recordId) });
      if (!record) return reply.code(404).send({ error: 'evp_record_not_found' });
      // Account can only be opened once the permit is approved (final onboarding step).
      if (record.status !== 'approved') {
        return reply.code(409).send({ error: 'evp_not_approved' });
      }

      const application = await db.query.driverApplications.findFirst({
        where: eq(driverApplications.driverId, record.driverId),
      });
      if (!application) return reply.code(404).send({ error: 'application_not_found' });

      const now = new Date();

      await db.transaction(async (tx) => {
        await tx
          .update(driverApplications)
          .set({ state: 'activated', approvedAt: application.approvedAt ?? now, updatedAt: now })
          .where(eq(driverApplications.driverId, record.driverId));

        if (application.state !== 'activated') {
          await tx.insert(notificationInbox).values({
            userId: record.driverId,
            category: 'evp',
            title: 'Account activated',
            body: 'Your Teeko driver account is now active. You can start accepting trips.',
            deeplink: 'evp_update',
          });
        }
      });

      return { ok: true, account: 'open' as const };
    },
  );
}

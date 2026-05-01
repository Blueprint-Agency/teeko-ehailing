import { db, sql } from '../src/config/db';
import { users, userRoles } from '../src/db/schema/identity';
import { driverProfiles, vehicles } from '../src/db/schema/drivers';
import { driverApplications, documents, documentReviews } from '../src/db/schema/onboarding';
import { notificationInbox } from '../src/db/schema/notifications-content';

// Fixed UUIDs so the frontend can reference them via env var
export const MOCK_DRIVER_ID = '00000000-0000-0000-0000-000000000001';
export const MOCK_VEHICLE_ID = '00000000-0000-0000-0000-000000000002';
export const MOCK_APPLICATION_ID = '00000000-0000-0000-0000-000000000003';

async function seed() {
  console.log('Seeding mock driver...');

  // ── User ──────────────────────────────────────────────────────────────────
  await db.insert(users).values({
    id: MOCK_DRIVER_ID,
    phone: '+60123456789',
    email: 'faizal@example.com',
    fullName: 'Ahmad Faizal bin Hamdan',
    locale: 'ms',
    status: 'active',
  }).onConflictDoNothing();

  await db.insert(userRoles).values({
    userId: MOCK_DRIVER_ID,
    role: 'driver',
  }).onConflictDoNothing();

  // ── Driver profile ────────────────────────────────────────────────────────
  await db.insert(driverProfiles).values({
    userId: MOCK_DRIVER_ID,
    approvalStatus: 'pending',
  }).onConflictDoNothing();

  // ── Vehicle ───────────────────────────────────────────────────────────────
  await db.insert(vehicles).values({
    id: MOCK_VEHICLE_ID,
    driverId: MOCK_DRIVER_ID,
    plateNumber: 'WXY 1234',
    make: 'Perodua',
    model: 'Myvi',
    year: 2021,
    colour: 'Silver',
    category: 'go',
  }).onConflictDoNothing();

  // ── Application (in_review = documents submitted, under admin review) ─────
  await db.insert(driverApplications).values({
    id: MOCK_APPLICATION_ID,
    driverId: MOCK_DRIVER_ID,
    state: 'in_review',
    submittedAt: new Date('2025-01-10T09:30:00Z'),
  }).onConflictDoNothing();

  // ── Personal documents ────────────────────────────────────────────────────
  type DocKind = 'nric_front' | 'nric_back' | 'cdl' | 'psv_d' | 'driver_selfie' | 'car_grant' | 'road_tax' | 'puspakom' | 'insurance';
  type ReviewStatus = 'approved' | 'rejected' | 'pending';

  const personalDocs: { id: string; kind: DocKind; reviewStatus: ReviewStatus; rejectionReason?: string }[] = [
    { id: '10000000-0000-0000-0000-000000000001', kind: 'nric_front',    reviewStatus: 'approved' },
    { id: '10000000-0000-0000-0000-000000000002', kind: 'nric_back',     reviewStatus: 'approved' },
    { id: '10000000-0000-0000-0000-000000000003', kind: 'cdl',           reviewStatus: 'approved' },
    { id: '10000000-0000-0000-0000-000000000004', kind: 'psv_d',         reviewStatus: 'pending' },
    { id: '10000000-0000-0000-0000-000000000005', kind: 'insurance',     reviewStatus: 'rejected', rejectionReason: 'Cover note expired. Please upload a valid e-hailing insurance cover note.' },
    { id: '10000000-0000-0000-0000-000000000006', kind: 'driver_selfie', reviewStatus: 'approved' },
  ];

  const vehicleDocs: { id: string; kind: DocKind; reviewStatus: ReviewStatus }[] = [
    { id: '20000000-0000-0000-0000-000000000001', kind: 'car_grant',  reviewStatus: 'approved' },
    { id: '20000000-0000-0000-0000-000000000002', kind: 'road_tax',   reviewStatus: 'approved' },
    { id: '20000000-0000-0000-0000-000000000003', kind: 'insurance',  reviewStatus: 'pending' },
    { id: '20000000-0000-0000-0000-000000000004', kind: 'puspakom',   reviewStatus: 'pending' },
  ];

  for (const doc of personalDocs) {
    await db.insert(documents).values({
      id: doc.id,
      ownerKind: 'driver',
      ownerId: MOCK_DRIVER_ID,
      kind: doc.kind,
      gcsPath: `mock/driver/${MOCK_DRIVER_ID}/${doc.kind}.jpg`,
      mimeType: 'image/jpeg',
      uploadedAt: new Date('2025-01-10T09:00:00Z'),
    }).onConflictDoNothing();

    await db.insert(documentReviews).values({
      documentId: doc.id,
      status: doc.reviewStatus,
      reason: doc.rejectionReason ?? null,
      reviewedAt: doc.reviewStatus !== 'pending' ? new Date('2025-01-11T10:00:00Z') : null,
    }).onConflictDoNothing();
  }

  for (const doc of vehicleDocs) {
    await db.insert(documents).values({
      id: doc.id,
      ownerKind: 'vehicle',
      ownerId: MOCK_VEHICLE_ID,
      kind: doc.kind,
      gcsPath: `mock/vehicle/${MOCK_VEHICLE_ID}/${doc.kind}.jpg`,
      mimeType: 'image/jpeg',
      uploadedAt: new Date('2025-01-10T09:15:00Z'),
    }).onConflictDoNothing();

    await db.insert(documentReviews).values({
      documentId: doc.id,
      status: doc.reviewStatus,
      reviewedAt: doc.reviewStatus !== 'pending' ? new Date('2025-01-11T10:00:00Z') : null,
    }).onConflictDoNothing();
  }

  // ── Notifications ─────────────────────────────────────────────────────────
  const notifs = [
    {
      id: '30000000-0000-0000-0000-000000000001',
      category: 'doc_expiry' as const,
      title: 'NRIC/MyKad Approved',
      body: 'Your NRIC/MyKad documents have been verified and approved.',
      deeplink: 'doc_approved',
      createdAt: new Date('2025-01-11T10:05:00Z'),
      readAt: new Date('2025-01-11T11:00:00Z'),
    },
    {
      id: '30000000-0000-0000-0000-000000000002',
      category: 'doc_expiry' as const,
      title: 'Insurance Cover Note Rejected',
      body: 'Your e-hailing insurance cover note was rejected. Cover note expired. Please upload a valid e-hailing insurance cover note.',
      deeplink: 'doc_rejected',
      createdAt: new Date('2025-01-11T10:10:00Z'),
      readAt: null,
    },
    {
      id: '30000000-0000-0000-0000-000000000003',
      category: 'doc_expiry' as const,
      title: 'CDL Approved',
      body: 'Your Competent Driving Licence has been verified and approved.',
      deeplink: 'doc_approved',
      createdAt: new Date('2025-01-11T10:06:00Z'),
      readAt: null,
    },
  ];

  for (const n of notifs) {
    await db.insert(notificationInbox).values({
      id: n.id,
      userId: MOCK_DRIVER_ID,
      category: n.category,
      title: n.title,
      body: n.body,
      deeplink: n.deeplink,
      createdAt: n.createdAt,
      readAt: n.readAt,
    }).onConflictDoNothing();
  }

  console.log('Seed complete.');
  console.log(`  Driver ID : ${MOCK_DRIVER_ID}`);
  console.log(`  Vehicle ID: ${MOCK_VEHICLE_ID}`);
  console.log('  Set NEXT_PUBLIC_DEV_DRIVER_ID in apps/web/.env.local');
}

seed()
  .catch((err) => { console.error(err); process.exit(1); })
  .finally(() => sql.end());

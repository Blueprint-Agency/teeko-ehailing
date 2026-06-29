import { db, sql } from '../src/config/db';
import { users, userRoles } from '../src/db/schema/identity';
import { driverProfiles, vehicles } from '../src/db/schema/drivers';
import { riderProfiles } from '../src/db/schema/riders';
import { trips } from '../src/db/schema/trips';
import { driverApplications, documents, documentReviews } from '../src/db/schema/onboarding';
import { notificationInbox } from '../src/db/schema/notifications-content';

// Fixed UUIDs so the frontend can reference them via env var
export const MOCK_DRIVER_ID = '00000000-0000-0000-0000-000000000001';
export const MOCK_VEHICLE_ID = '00000000-0000-0000-0000-000000000002';
export const MOCK_APPLICATION_ID = '00000000-0000-0000-0000-000000000003';
export const MOCK_ADMIN_ID = '00000000-0000-0000-0000-0000000000a0';

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

  // ── Admin user (for the admin panel dev-bypass auth) ───────────────────────
  await db.insert(users).values({
    id: MOCK_ADMIN_ID,
    phone: '+60100000000',
    email: 'admin@teeko.my',
    fullName: 'Teeko Admin',
    locale: 'en',
    status: 'active',
  }).onConflictDoNothing();

  await db.insert(userRoles).values({
    userId: MOCK_ADMIN_ID,
    role: 'admin_super',
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
    }).onConflictDoNothing({ target: documentReviews.documentId });
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
    }).onConflictDoNothing({ target: documentReviews.documentId });
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

  // ── Riders ────────────────────────────────────────────────────────────────
  // A small directory of riders the admin panel lists. Completed trips drive
  // the `trips` count and `totalSpent` (sum of finalFareCents) the API derives.
  await seedRiders();

  console.log('Seed complete.');
  console.log(`  Driver ID : ${MOCK_DRIVER_ID}`);
  console.log(`  Vehicle ID: ${MOCK_VEHICLE_ID}`);
  console.log(`  Admin ID  : ${MOCK_ADMIN_ID}`);
  console.log('  Set NEXT_PUBLIC_DEV_DRIVER_ID in apps/web/.env.local');
  console.log('  Set NEXT_PUBLIC_ADMIN_DEV_USER in apps/admin/.env.local');
}

// ── Rider directory ──────────────────────────────────────────────────────────
async function seedRiders() {
  console.log('Seeding mock riders...');

  // KL city centre — trips get small per-trip jitter so they aren't all identical.
  const PICKUP = { lng: 101.6869, lat: 3.139 };
  const DROPOFF = { lng: 101.7117, lat: 3.158 };

  type SeedRider = {
    n: number; // stable index used to derive deterministic UUIDs
    fullName: string;
    phone: string;
    email: string;
    locale: 'en' | 'ms' | 'zh' | 'ta';
    status: 'active' | 'suspended' | 'deactivated';
    ratingAvg: string;
    ratingCount: number;
    // finalFare (RM) for each completed trip; length = lifetime trip count
    fares: number[];
    // one extra non-completed trip to prove the count only tallies completed ones
    pending?: boolean;
  };

  const riders: SeedRider[] = [
    { n: 1, fullName: 'Aishah Binti Nordin', phone: '+60112345670', email: 'aishah@example.com', locale: 'ms', status: 'active',      ratingAvg: '4.90', ratingCount: 48, fares: [12, 28, 15, 9, 34] },
    { n: 2, fullName: 'Marcus Tan Jia Wei',  phone: '+60119876544', email: 'marcus@example.com', locale: 'zh', status: 'active',      ratingAvg: '4.50', ratingCount: 132, fares: [22, 18, 41, 7], pending: true },
    { n: 3, fullName: 'Priscilla Gomez',     phone: '+60161234568', email: 'prisc@example.com',  locale: 'en', status: 'active',      ratingAvg: '4.70', ratingCount: 21, fares: [16, 33] },
    { n: 4, fullName: 'Suresh Kumar a/l Raj',phone: '+60173456712', email: 'suresh@example.com', locale: 'ta', status: 'suspended',   ratingAvg: '3.80', ratingCount: 9,  fares: [11] },
    { n: 5, fullName: 'Wong Mei Ling',       phone: '+60125550199', email: 'meiling@example.com',locale: 'zh', status: 'deactivated', ratingAvg: '4.20', ratingCount: 4,  fares: [] },
  ];

  // Deterministic UUIDs: rider 5xxx…, trips 6xxx… keyed by rider + trip index.
  const riderId = (n: number) => `50000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
  const tripId = (n: number, t: number) =>
    `6000${String(n).padStart(4, '0')}-0000-0000-0000-${String(t).padStart(12, '0')}`;
  const wkt = (lng: number, lat: number) => `SRID=4326;POINT(${lng} ${lat})`;

  for (const r of riders) {
    const id = riderId(r.n);

    await db.insert(users).values({
      id,
      phone: r.phone,
      email: r.email,
      fullName: r.fullName,
      locale: r.locale,
      status: r.status,
      createdAt: new Date(2024, 0, r.n * 5), // staggered join dates
    }).onConflictDoNothing();

    await db.insert(userRoles).values({ userId: id, role: 'rider' }).onConflictDoNothing();

    await db.insert(riderProfiles).values({
      userId: id,
      ratingAvg: r.ratingAvg,
      ratingCount: r.ratingCount,
    }).onConflictDoNothing();

    let t = 0;
    for (const fare of r.fares) {
      t += 1;
      const jitter = t * 0.001;
      await db.insert(trips).values({
        id: tripId(r.n, t),
        riderId: id,
        driverId: MOCK_DRIVER_ID,
        status: 'completed',
        category: 'go',
        pickup: wkt(PICKUP.lng + jitter, PICKUP.lat + jitter),
        dropoff: wkt(DROPOFF.lng + jitter, DROPOFF.lat + jitter),
        pickupAddress: 'KLCC, Kuala Lumpur',
        dropoffAddress: 'Mid Valley Megamall, Kuala Lumpur',
        finalFareCents: fare * 100,
        completedAt: new Date(2025, 0, r.n, 9 + t),
      }).onConflictDoNothing();
    }

    if (r.pending) {
      t += 1;
      await db.insert(trips).values({
        id: tripId(r.n, t),
        riderId: id,
        driverId: MOCK_DRIVER_ID,
        status: 'in_trip',
        category: 'go',
        pickup: wkt(PICKUP.lng, PICKUP.lat),
        dropoff: wkt(DROPOFF.lng, DROPOFF.lat),
        pickupAddress: 'KLCC, Kuala Lumpur',
        dropoffAddress: 'Mid Valley Megamall, Kuala Lumpur',
      }).onConflictDoNothing();
    }
  }

  console.log(`  Seeded ${riders.length} riders.`);
}

seed()
  .catch((err) => { console.error(err); process.exit(1); })
  .finally(() => sql.end());

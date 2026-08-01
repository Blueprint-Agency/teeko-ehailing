import { db, sql } from '../src/config/db';
import { users, userRoles } from '../src/db/schema/identity';
import { driverProfiles, vehicles } from '../src/db/schema/drivers';
import { riderProfiles } from '../src/db/schema/riders';
import { trips } from '../src/db/schema/trips';
import { driverApplications, documents, documentReviews } from '../src/db/schema/onboarding';
import { evpRecords } from '../src/db/schema/compliance';
import { notificationInbox } from '../src/db/schema/notifications-content';
import { feedback } from '../src/db/schema/feedback-disputes';
import { disputes } from '../src/db/schema/trips';
import { payments, driverEarnings, payouts, refunds } from '../src/db/schema/payments';

// Fixed UUIDs so the frontend can reference them via env var
export const MOCK_DRIVER_ID = '00000000-0000-0000-0000-000000000001';
export const MOCK_VEHICLE_ID = '00000000-0000-0000-0000-000000000002';
export const MOCK_APPLICATION_ID = '00000000-0000-0000-0000-000000000003';
export const MOCK_ADMIN_ID = '00000000-0000-0000-0000-0000000000a0';
export const MOCK_ADMIN_STAFF_ID = '00000000-0000-0000-0000-0000000000a1';

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

  // ── Generic admin (no super-admin privileges — cannot deactivate admins) ────
  await db.insert(users).values({
    id: MOCK_ADMIN_STAFF_ID,
    phone: '+60100000001',
    email: 'staff@teeko.my',
    fullName: 'Admin',
    locale: 'en',
    status: 'active',
  }).onConflictDoNothing();

  await db.insert(userRoles).values({
    userId: MOCK_ADMIN_STAFF_ID,
    role: 'admin',
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

  // ── Driver directory ────────────────────────────────────────────────────
  // The 20 drivers the admin panel lists. Real user/profile/vehicle/EVP rows so
  // that admin status changes (suspend/deactivate/reinstate/approve) persist.
  await seedDriverDirectory();

  // ── Riders ────────────────────────────────────────────────────────────────
  // A small directory of riders the admin panel lists. Completed trips drive
  // the `trips` count and `totalSpent` (sum of finalFareCents) the API derives.
  await seedRiders();

  // ── Recent financials ───────────────────────────────────────────────────────
  // Last-30-day trips/payments/earnings/payouts/refunds so the admin Revenue
  // Reports charts render real data (the fixtures above are dated 2025).
  await seedRecentFinance();

  console.log('Seed complete.');
  console.log(`  Driver ID : ${MOCK_DRIVER_ID}`);
  console.log(`  Vehicle ID: ${MOCK_VEHICLE_ID}`);
  console.log(`  Admin ID  : ${MOCK_ADMIN_ID}`);
  console.log('  Set NEXT_PUBLIC_DEV_DRIVER_ID in apps/web/.env.local');
  console.log('  Set NEXT_PUBLIC_ADMIN_DEV_USER in apps/admin/.env.local');
}

// ── Driver directory ─────────────────────────────────────────────────────────
// Mirrors the former apps/admin/data/mock-drivers.json so the admin drivers list
// is backed by real rows. Admin `status` maps onto driver_profiles.approval_status
// (+ users.status); `evp` onto an evp_records row.
async function seedDriverDirectory() {
  console.log('Seeding driver directory...');

  type AdminStatus = 'active' | 'pending' | 'suspended' | 'inactive';
  type Evp = 'approved' | 'pending' | 'expired' | 'not_applied';
  type Tier = 'Standard' | 'Premium' | 'Economy';

  type SeedDriver = {
    n: number;
    name: string;
    phone: string;
    email: string;
    city: string;
    tier: Tier;
    status: AdminStatus;
    evp: Evp;
    rating: number;
    trips: number;
    joinDate: string;
    vehicle: string; // "<make> <model...> <year>"
    plate: string;
  };

  const directory: SeedDriver[] = [
    { n: 1,  name: 'Ahmad Faris Bin Azman',     phone: '+601112345678', email: 'faris@mail.com',   city: 'Kuala Lumpur',  tier: 'Standard', status: 'active',    evp: 'approved',    rating: 4.8, trips: 342, joinDate: '2024-01-15', vehicle: 'Perodua Myvi 2022',  plate: 'WFR 1234' },
    { n: 2,  name: 'Tan Wei Loong',             phone: '+601198765432', email: 'weig@mail.com',    city: 'Petaling Jaya', tier: 'Premium',  status: 'active',    evp: 'approved',    rating: 4.9, trips: 512, joinDate: '2023-11-22', vehicle: 'Honda City 2023',    plate: 'VBN 5678' },
    { n: 3,  name: 'Rajan Krishnaswamy',        phone: '+601161234567', email: 'rajan@mail.com',   city: 'Subang Jaya',   tier: 'Economy',  status: 'pending',   evp: 'pending',     rating: 0,   trips: 0,   joinDate: '2025-12-01', vehicle: 'Proton Saga 2020',   plate: 'BCD 9012' },
    { n: 4,  name: 'Nurul Hazirah Binti Salleh',phone: '+601133456789', email: 'nurul@mail.com',   city: 'Kuala Lumpur',  tier: 'Standard', status: 'suspended', evp: 'approved',    rating: 3.9, trips: 87,  joinDate: '2024-06-10', vehicle: 'Perodua Axia 2021',  plate: 'KLM 3456' },
    { n: 5,  name: 'Lee Chong Wei Jr',          phone: '+601187654321', email: 'lcw@mail.com',     city: 'Cyberjaya',     tier: 'Standard', status: 'active',    evp: 'approved',    rating: 4.6, trips: 208, joinDate: '2024-03-05', vehicle: 'Honda Jazz 2022',    plate: 'PQR 7890' },
    { n: 6,  name: 'Mohd Hafiz Bin Ismail',     phone: '+601145678901', email: 'hafiz@mail.com',   city: 'Shah Alam',     tier: 'Economy',  status: 'active',    evp: 'approved',    rating: 4.7, trips: 432, joinDate: '2023-08-17', vehicle: 'Perodua Bezza 2021', plate: 'STU 2345' },
    { n: 7,  name: 'Siti Aminah Binti Kadir',   phone: '+601176543210', email: 'siti@mail.com',    city: 'Kuala Lumpur',  tier: 'Premium',  status: 'inactive',  evp: 'expired',     rating: 4.5, trips: 156, joinDate: '2024-01-28', vehicle: 'Toyota Vios 2023',   plate: 'DEF 6789' },
    { n: 8,  name: 'Krishnan Pillai',           phone: '+601156789012', email: 'kris@mail.com',    city: 'Ampang',        tier: 'Standard', status: 'active',    evp: 'approved',    rating: 4.4, trips: 298, joinDate: '2024-02-14', vehicle: 'Perodua Myvi 2021',  plate: 'GHI 1357' },
    { n: 9,  name: 'Zainuddin Bin Bakar',       phone: '+601178901234', email: 'zain@mail.com',    city: 'Klang',         tier: 'Economy',  status: 'pending',   evp: 'pending',     rating: 0,   trips: 0,   joinDate: '2026-01-10', vehicle: 'Honda Brio 2020',    plate: 'JKL 2468' },
    { n: 10, name: 'Farah Liyana Bt Yusoff',    phone: '+601123456789', email: 'farah@mail.com',   city: 'Kuala Lumpur',  tier: 'Standard', status: 'active',    evp: 'approved',    rating: 4.9, trips: 621, joinDate: '2023-06-01', vehicle: 'Toyota Vios 2022',   plate: 'MNO 9753' },
    { n: 11, name: 'Chong Kim Fatt',            phone: '+601198765430', email: 'ckf@mail.com',     city: 'Petaling Jaya', tier: 'Premium',  status: 'active',    evp: 'approved',    rating: 4.8, trips: 389, joinDate: '2023-09-20', vehicle: 'Honda Accord 2022',  plate: 'PRS 8642' },
    { n: 12, name: 'Normah Binti Ahmad',        phone: '+601167890123', email: 'norma@mail.com',   city: 'Selayang',      tier: 'Economy',  status: 'suspended', evp: 'approved',    rating: 3.2, trips: 44,  joinDate: '2024-08-15', vehicle: 'Perodua Axia 2019',  plate: 'TUV 5731' },
    { n: 13, name: 'Vijayakumar Nadarajan',     phone: '+601145678902', email: 'vijay@mail.com',   city: 'Puchong',       tier: 'Standard', status: 'active',    evp: 'approved',    rating: 4.6, trips: 277, joinDate: '2024-04-22', vehicle: 'Honda City 2021',    plate: 'WXZ 4862' },
    { n: 14, name: 'Izzatul Husna Binti Mohd',  phone: '+601134567890', email: 'izzatul@mail.com', city: 'Kuala Lumpur',  tier: 'Standard', status: 'active',    evp: 'approved',    rating: 4.7, trips: 183, joinDate: '2024-07-11', vehicle: 'Perodua Myvi 2023',  plate: 'ABC 3971' },
    { n: 15, name: 'Lim Boon Seng',             phone: '+601189012345', email: 'lbs@mail.com',     city: 'Subang Jaya',   tier: 'Economy',  status: 'inactive',  evp: 'expired',     rating: 4.3, trips: 124, joinDate: '2024-02-01', vehicle: 'Perodua Bezza 2020', plate: 'DEG 7532' },
    { n: 16, name: 'Hafizuddin Bin Ramli',      phone: '+601156789013', email: 'hafizr@mail.com',  city: 'Kuala Lumpur',  tier: 'Premium',  status: 'active',    evp: 'approved',    rating: 4.9, trips: 847, joinDate: '2023-02-28', vehicle: 'BMW 320i 2023',      plate: 'VIP 6419' },
    { n: 17, name: 'Saritha Devi Munisamy',     phone: '+601167890124', email: 'saritha@mail.com', city: 'Ampang',        tier: 'Standard', status: 'active',    evp: 'approved',    rating: 4.5, trips: 159, joinDate: '2024-09-05', vehicle: 'Honda Jazz 2021',    plate: 'GHJ 2843' },
    { n: 18, name: 'Mohd Azlan Bin Che Hassan', phone: '+601178901235', email: 'azlan@mail.com',   city: 'Shah Alam',     tier: 'Economy',  status: 'pending',   evp: 'not_applied', rating: 0,   trips: 0,   joinDate: '2026-02-20', vehicle: 'Perodua Alza 2022',  plate: 'KLN 5196' },
    { n: 19, name: 'Wong Siew Lian',            phone: '+601123456790', email: 'wsl@mail.com',     city: 'Petaling Jaya', tier: 'Standard', status: 'active',    evp: 'approved',    rating: 4.6, trips: 264, joinDate: '2024-01-03', vehicle: 'Toyota Yaris 2022',  plate: 'PQT 8367' },
    { n: 20, name: 'Tengku Aidil Fadzillah',    phone: '+601145678903', email: 'aidil@mail.com',   city: 'Kuala Lumpur',  tier: 'Premium',  status: 'active',    evp: 'approved',    rating: 4.7, trips: 445, joinDate: '2023-07-19', vehicle: 'Mercedes C200 2023', plate: 'AIDIL' },
  ];

  // Admin status → (users.status, driver_profiles.approval_status).
  const USER_STATUS: Record<AdminStatus, 'active' | 'suspended' | 'deactivated'> = {
    active: 'active', pending: 'active', suspended: 'suspended', inactive: 'deactivated',
  };
  const APPROVAL: Record<AdminStatus, 'pending' | 'approved' | 'suspended' | 'deactivated'> = {
    active: 'approved', pending: 'pending', suspended: 'suspended', inactive: 'deactivated',
  };
  // Service tier → ride_category enum on the vehicle.
  const CATEGORY: Record<Tier, 'go' | 'comfort' | 'premium'> = {
    Economy: 'go', Standard: 'comfort', Premium: 'premium',
  };

  const driverId = (n: number) => `70000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
  const vehicleId = (n: number) => `71000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
  const evpId = (n: number) => `72000000-0000-0000-0000-${String(n).padStart(12, '0')}`;

  // "Perodua Myvi 2022" → { make: 'Perodua', model: 'Myvi', year: 2022 }
  const parseVehicle = (s: string) => {
    const parts = s.split(' ');
    const year = Number(parts[parts.length - 1]);
    return { make: parts[0] ?? s, model: parts.slice(1, -1).join(' '), year };
  };

  for (const d of directory) {
    const id = driverId(d.n);
    const { make, model, year } = parseVehicle(d.vehicle);

    await db.insert(users).values({
      id,
      phone: d.phone,
      email: d.email,
      fullName: d.name,
      locale: 'ms',
      status: USER_STATUS[d.status],
      createdAt: new Date(`${d.joinDate}T09:00:00Z`),
    }).onConflictDoNothing();

    await db.insert(userRoles).values({ userId: id, role: 'driver' }).onConflictDoNothing();

    await db.insert(driverProfiles).values({
      userId: id,
      approvalStatus: APPROVAL[d.status],
      availability: 'offline',
      ratingAvg: d.rating ? d.rating.toFixed(2) : null,
      ratingCount: d.trips,
      totalTrips: d.trips,
    }).onConflictDoNothing();

    await db.insert(vehicles).values({
      id: vehicleId(d.n),
      driverId: id,
      plateNumber: d.plate,
      make,
      model,
      year,
      category: CATEGORY[d.tier],
      isActive: d.status === 'active',
    }).onConflictDoNothing();

    // EVP application row (the admin list reads `evp` from here). `not_applied`
    // drivers have no record — the list left-joins and defaults to 'not_applied'.
    if (d.evp !== 'not_applied') {
      await db.insert(evpRecords).values({
        id: evpId(d.n),
        vehicleId: vehicleId(d.n),
        driverId: id,
        authority: 'apad',
        region: d.city,
        status: d.evp,
        submittedAt: new Date(`${d.joinDate}T09:30:00Z`),
        approvedAt: d.evp === 'approved' ? new Date(`${d.joinDate}T12:00:00Z`) : null,
        expiryDate: d.evp === 'approved' ? '2027-01-01' : d.evp === 'expired' ? '2025-06-01' : null,
      }).onConflictDoNothing();
    }
  }

  console.log(`  Seeded ${directory.length} drivers.`);
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

  await seedFeedbackAndDisputes();
}

// Feedback + disputes reference the deterministic rider/trip UUIDs minted above.
async function seedFeedbackAndDisputes() {
  console.log('Seeding feedback & disputes...');

  const riderId = (n: number) => `50000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
  const tripId = (n: number, t: number) =>
    `6000${String(n).padStart(4, '0')}-0000-0000-0000-${String(t).padStart(12, '0')}`;
  const uid = (kind: string, n: number) =>
    `${kind}000000-0000-0000-0000-${String(n).padStart(12, '0')}`;

  // ── Feedback (general, not formal disputes) ─────────────────────────────────
  const feedbacks = [
    { n: 1, userId: riderId(1), tripId: tripId(1, 2), role: 'rider' as const, category: 'driver' as const,     rating: 5, message: 'Driver was super friendly and the car was spotless. Great ride!' },
    { n: 2, userId: riderId(2), tripId: tripId(2, 1), role: 'rider' as const, category: 'app' as const,        rating: 3, message: 'The map took a while to load when I opened the app. Otherwise fine.' },
    { n: 3, userId: riderId(3), tripId: tripId(3, 1), role: 'rider' as const, category: 'ride' as const,       rating: 4, message: 'Smooth trip but pickup point was a little hard to find.' },
    { n: 4, userId: riderId(1), tripId: null,          role: 'rider' as const, category: 'suggestion' as const, rating: null, message: 'Would love to be able to schedule recurring rides to work.' },
    { n: 5, userId: MOCK_DRIVER_ID, tripId: tripId(2, 1), role: 'driver' as const, category: 'payment' as const, rating: 2, message: 'Payout for last week came in a day late.' },
  ];
  for (const f of feedbacks) {
    await db.insert(feedback).values({
      id: uid('fb', f.n),
      userId: f.userId,
      tripId: f.tripId,
      role: f.role,
      category: f.category,
      rating: f.rating,
      message: f.message,
      createdAt: new Date(2025, 5, f.n, 10, 0),
    }).onConflictDoNothing();
  }

  // ── Disputes across every queue ─────────────────────────────────────────────
  //   open                    → Dispute Queue
  //   refund_pending/...      → Refund Queue
  //   refund_completed/reject → Dispute Completion
  // Categories are mapped onto staging's rider dispute enum
  // (overcharge / payment / service / safety / lost_item / other).
  const disputeRows = [
    { n: 1, tripId: tripId(1, 1), riderId: riderId(1), category: 'overcharge' as const, status: 'open' as const,              amountCents: 1500, description: 'Charged RM15 more than the quoted fare shown before booking.' },
    { n: 2, tripId: tripId(2, 1), riderId: riderId(2), category: 'service' as const,    status: 'open' as const,              amountCents: 800,  description: 'Driver took a much longer route via the tolled highway without asking.' },
    { n: 3, tripId: tripId(3, 1), riderId: riderId(3), category: 'service' as const,    status: 'open' as const,              amountCents: 0,    description: 'Driver was rude and refused to turn on the air-conditioning.' },
    { n: 4, tripId: tripId(1, 3), riderId: riderId(1), category: 'payment' as const,    status: 'refund_pending' as const,    amountCents: 2200, description: 'Double charged for a single trip.', resolution: 'Verified duplicate charge — refund approved.' },
    { n: 5, tripId: tripId(2, 2), riderId: riderId(2), category: 'overcharge' as const, status: 'refund_processing' as const, amountCents: 1200, description: 'Surge applied but there was no surge at the time.', resolution: 'Refund approved.', refundRef: 'RF-2025-0012' },
    { n: 6, tripId: tripId(1, 4), riderId: riderId(1), category: 'service' as const,    status: 'refund_completed' as const,  amountCents: 900,  description: 'Seats were wet and stained. Requested a partial refund.', resolution: 'Partial refund approved.', refundRef: 'RF-2025-0008' },
    { n: 7, tripId: tripId(3, 2), riderId: riderId(3), category: 'other' as const,      status: 'rejected' as const,          amountCents: 0,    description: 'Claimed forgotten item but lost-item report already resolved.', resolution: 'No refundable amount; handled via lost-item flow.' },
  ];
  for (const d of disputeRows) {
    const terminal = d.status === 'refund_completed' || d.status === 'rejected';
    await db.insert(disputes).values({
      id: uid('d5', d.n),
      tripId: d.tripId,
      riderId: d.riderId,
      category: d.category,
      status: d.status,
      amountCents: d.amountCents,
      description: d.description,
      resolution: d.resolution ?? null,
      refundRef: d.refundRef ?? null,
      handledBy: terminal || d.status.startsWith('refund_') ? MOCK_ADMIN_ID : null,
      resolvedAt: terminal ? new Date(2025, 5, 20 + d.n, 14, 0) : null,
      createdAt: new Date(2025, 5, 10 + d.n, 9, 0),
    }).onConflictDoNothing();
  }

  console.log(`  Seeded ${feedbacks.length} feedback + ${disputeRows.length} disputes.`);
}

// Recent (last-30-day) financial activity so the admin Revenue Reports charts have
// real data. Populates the exact tables the /admin/revenue/daily endpoint reads:
//   revenue + trips → trips (completed, finalFareCents)
//   commissions     → driver_earnings.commissionCents
//   payouts         → payouts.amountCents (status 'paid')
//   refunds         → refunds.amountCents (status 'succeeded'; needs a parent payment)
// Deterministic UUIDs (prefix 7x) + onConflictDoNothing keep re-runs idempotent.
async function seedRecentFinance() {
  console.log('Seeding recent financial activity (last 30 days)...');

  const DAYS = 30;
  const PICKUP = { lng: 101.6869, lat: 3.139 };
  const DROPOFF = { lng: 101.7117, lat: 3.158 };
  const wkt = (lng: number, lat: number) => `SRID=4326;POINT(${lng} ${lat})`;
  const riderId = (n: number) => `50000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
  const hex12 = (n: number) => String(n).padStart(12, '0');
  const uuid = (prefix: string, n: number) => `${prefix}-0000-0000-0000-${hex12(n)}`;

  // A date `d` days before now, at a fixed hour (deterministic, no time-of-day drift).
  const dayAt = (d: number, hour: number) => {
    const dt = new Date();
    dt.setHours(hour, 0, 0, 0);
    dt.setDate(dt.getDate() - d);
    return dt;
  };

  const CATEGORIES = ['go', 'go', 'premium']; // weighted toward the cheaper tier
  let seq = 0;
  let tripCount = 0;
  let payoutCount = 0;
  let refundCount = 0;

  for (let d = DAYS - 1; d >= 0; d--) {
    // 3–6 trips/day, varying deterministically by day.
    const perDay = 3 + (d % 4);
    let dayNet = 0;

    for (let i = 0; i < perDay; i++) {
      seq += 1;
      const rId = riderId((seq % 5) + 1); // cycle active-ish riders 1..5
      const fareCents = 1200 + ((seq * 137) % 4800); // ~RM12–60
      const commissionCents = Math.round(fareCents * 0.2); // 20% platform cut
      const netCents = fareCents - commissionCents;
      dayNet += netCents;

      const tId = uuid('70000000', seq);
      const pId = uuid('72000000', seq);
      const jitter = i * 0.001;
      const at = dayAt(d, 8 + i);

      await db.insert(trips).values({
        id: tId,
        riderId: rId,
        driverId: MOCK_DRIVER_ID,
        status: 'completed',
        category: CATEGORIES[seq % CATEGORIES.length]!,
        pickup: wkt(PICKUP.lng + jitter, PICKUP.lat + jitter),
        dropoff: wkt(DROPOFF.lng + jitter, DROPOFF.lat + jitter),
        pickupAddress: 'KLCC, Kuala Lumpur',
        dropoffAddress: 'Mid Valley Megamall, Kuala Lumpur',
        finalFareCents: fareCents,
        completedAt: at,
        createdAt: at,
      }).onConflictDoNothing();
      tripCount += 1;

      await db.insert(payments).values({
        id: pId,
        tripId: tId,
        riderId: rId,
        driverId: MOCK_DRIVER_ID,
        kind: 'trip_fare',
        methodType: 'card',
        amountCents: fareCents,
        commissionCents,
        status: 'succeeded',
        createdAt: at,
      }).onConflictDoNothing();

      await db.insert(driverEarnings).values({
        id: uuid('71000000', seq),
        driverId: MOCK_DRIVER_ID,
        tripId: tId,
        paymentId: pId,
        grossCents: fareCents,
        commissionCents,
        netCents,
        transferred: true,
        createdAt: at,
      }).onConflictDoNothing();

      // Occasional partial refund (every 9th trip) tied to its payment.
      if (seq % 9 === 0) {
        await db.insert(refunds).values({
          id: uuid('74000000', seq),
          paymentId: pId,
          amountCents: Math.round(fareCents * 0.5),
          reason: 'rider_complaint',
          status: 'succeeded',
          issuedBy: MOCK_ADMIN_ID,
          createdAt: dayAt(d, 18), // later same day
        }).onConflictDoNothing();
        refundCount += 1;
      }
    }

    // One aggregated driver payout per day for that day's net earnings.
    payoutCount += 1;
    await db.insert(payouts).values({
      id: uuid('73000000', payoutCount),
      driverId: MOCK_DRIVER_ID,
      amountCents: dayNet,
      method: 'standard',
      status: 'paid',
      createdAt: dayAt(d, 21),
    }).onConflictDoNothing();
  }

  console.log(`  Seeded ${tripCount} trips, ${payoutCount} payouts, ${refundCount} refunds across ${DAYS} days.`);
}

seed()
  .catch((err) => { console.error(err); process.exit(1); })
  .finally(() => sql.end());

import { and, eq, or } from 'drizzle-orm';

import { db } from '../../config/db';
import { documents, documentReviews } from '../../db/schema/onboarding';
import { vehicles } from '../../db/schema/drivers';
import { evpRecords } from '../../db/schema/compliance';

// Onboarding does not yet capture the operating region, so default to APAD's
// Wilayah Persekutuan until a region picker is added to the application flow.
export const DEFAULT_EVP_AUTHORITY = 'apad' as const;
export const DEFAULT_EVP_REGION = 'Wilayah Persekutuan Kuala Lumpur';

const REQUIRED_PERSONAL = ['nric_front', 'nric_back', 'cdl', 'psv_d', 'insurance', 'driver_selfie'];
const REQUIRED_VEHICLE = ['car_grant', 'road_tax', 'puspakom', 'insurance'];

type Executor = Parameters<Parameters<typeof db.transaction>[0]>[0];

function allRequiredApproved(
  rows: { ownerKind: string; kind: string; reviewStatus: string | null }[],
): boolean {
  const approvedDriver = new Set(
    rows.filter((r) => r.ownerKind === 'driver' && r.reviewStatus === 'approved').map((r) => r.kind),
  );
  const approvedVehicle = new Set(
    rows.filter((r) => r.ownerKind === 'vehicle' && r.reviewStatus === 'approved').map((r) => r.kind),
  );
  return (
    REQUIRED_PERSONAL.every((k) => approvedDriver.has(k)) &&
    REQUIRED_VEHICLE.every((k) => approvedVehicle.has(k))
  );
}

export async function resolveDocumentDriverId(
  tx: Executor,
  doc: { ownerKind: string; ownerId: string },
): Promise<string | null> {
  if (doc.ownerKind === 'driver') return doc.ownerId;
  const vehicle = await tx.query.vehicles.findFirst({ where: eq(vehicles.id, doc.ownerId) });
  return vehicle?.driverId ?? null;
}

export async function ensureEvpRecordForDriver(tx: Executor, driverId: string): Promise<boolean> {
  const existing = await tx.query.evpRecords.findFirst({
    where: eq(evpRecords.driverId, driverId),
  });
  if (existing) return false;

  const vehicle = await tx.query.vehicles.findFirst({
    where: eq(vehicles.driverId, driverId),
  });
  if (!vehicle) return false;

  const docRows = await tx
    .select({
      ownerKind: documents.ownerKind,
      kind: documents.kind,
      reviewStatus: documentReviews.status,
    })
    .from(documents)
    .leftJoin(documentReviews, eq(documentReviews.documentId, documents.id))
    .where(
      or(
        and(eq(documents.ownerKind, 'driver'), eq(documents.ownerId, driverId)),
        and(eq(documents.ownerKind, 'vehicle'), eq(documents.ownerId, vehicle.id)),
      ),
    );

  if (!allRequiredApproved(docRows)) return false;

  await tx.insert(evpRecords).values({
    driverId,
    vehicleId: vehicle.id,
    authority: DEFAULT_EVP_AUTHORITY,
    region: DEFAULT_EVP_REGION,
    status: 'not_applied',
  });
  return true;
}

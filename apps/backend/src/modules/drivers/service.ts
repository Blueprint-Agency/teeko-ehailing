// modules/drivers/service.ts
// Profile, vehicles, online status, eligibility view.
// Single source of truth for the drivers domain.
// Routes call into this service; repos stay private to the module.
//
// Implemented so far: the driver's own profile + performance stats. Vehicles
// live in api/driver/vehicle.routes.ts (one per driver); online status is owned
// by the tracking module.

import { eq } from 'drizzle-orm';

import { db } from '../../db';
import { driverProfiles } from '../../db/schema/drivers';
import { users } from '../../db/schema/identity';
import { DomainError } from '../../shared/errors';

export type DriverProfileDto = {
  id: string;
  fullName: string | null;
  phone: string | null;
  email: string | null;
  /** Account status: active / suspended / deactivated. */
  status: string;
  /** Onboarding outcome: pending / approved / suspended / deactivated. */
  approvalStatus: string;
  availability: string;
  /** Null until the driver has been rated at least once — never fake a 5.0. */
  rating: number | null;
  ratingCount: number;
  totalTrips: number;
  acceptanceRate: number | null;
  cancellationRate: number | null;
  completionRate: number | null;
  joinedAt: string;
};

/** Drizzle returns `numeric` columns as strings to preserve precision. */
function toNumber(value: string | null | undefined): number | null {
  if (value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export const driversService = {
  async getProfile(driverId: string): Promise<DriverProfileDto> {
    const [user, profile] = await Promise.all([
      db.query.users.findFirst({ where: eq(users.id, driverId) }),
      db.query.driverProfiles.findFirst({ where: eq(driverProfiles.userId, driverId) }),
    ]);
    if (!user) throw new DomainError('DRIVER_NOT_FOUND', 'Driver not found.', 404);

    return {
      id: user.id,
      fullName: user.fullName,
      phone: user.phone,
      email: user.email,
      status: user.status,
      // The profile row is created at approval; treat its absence as pending
      // rather than an error, so a half-onboarded driver can still see itself.
      approvalStatus: profile?.approvalStatus ?? 'pending',
      availability: profile?.availability ?? 'offline',
      rating: profile?.ratingCount ? toNumber(profile.ratingAvg) : null,
      ratingCount: profile?.ratingCount ?? 0,
      totalTrips: profile?.totalTrips ?? 0,
      acceptanceRate: toNumber(profile?.acceptanceRate),
      cancellationRate: toNumber(profile?.cancellationRate),
      completionRate: toNumber(profile?.completionRate),
      joinedAt: user.createdAt.toISOString(),
    };
  },
};

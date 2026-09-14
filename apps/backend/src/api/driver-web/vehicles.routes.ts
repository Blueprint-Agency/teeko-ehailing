import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { db } from '../../config/db';
import { vehicles } from '../../db/schema/drivers';
import { driverApplications } from '../../db/schema/onboarding';
import { isValidPlate, normalisePlate } from '@teeko/shared/utils/plate';

// A driver has exactly one vehicle (see schema/drivers.ts). These routes still
// return an array so existing portal callers keep working, but it holds 0 or 1.
export async function routes(app: FastifyInstance) {
  app.get('/', async (req) => {
    const userId = req.user!.id;

    const v = await db.query.vehicles.findFirst({ where: eq(vehicles.driverId, userId) });
    if (!v) return [];

    return [
      {
        id: v.id,
        plateNumber: v.plateNumber,
        make: v.make,
        model: v.model,
        year: v.year,
        colour: v.colour ?? '',
        category: v.category,
      },
    ];
  });

  app.post<{
    Body: {
      plateNumber: string;
      make: string;
      model: string;
      year: number;
      colour?: string;
      category?: 'go' | 'comfort' | 'xl' | 'premium' | 'bike';
    };
  }>('/', async (req, reply) => {
    const userId = req.user!.id;
    const { make, model, year, colour, category = 'go' } = req.body;
    // Same canonical form as /application/onboard — the unique index depends on it.
    const plateNumber = normalisePlate(req.body.plateNumber);
    if (!isValidPlate(plateNumber)) {
      return reply.code(400).send({ error: 'invalid_vehicle', field: 'plateNumber' });
    }

    // Re-submitting replaces the driver's vehicle rather than adding a second —
    // this is also how a driver changes car, so the route stays idempotent.
    const existing = await db.query.vehicles.findFirst({ where: eq(vehicles.driverId, userId) });

    const [vehicle] = existing
      ? await db
          .update(vehicles)
          .set({ plateNumber, make, model, year, colour, category })
          .where(eq(vehicles.driverId, userId))
          .returning()
      : await db
          .insert(vehicles)
          .values({ driverId: userId, plateNumber, make, model, year, colour, category })
          .returning();

    // Advance application state to vehicle_added
    await db
      .update(driverApplications)
      .set({ state: 'vehicle_added', updatedAt: new Date() })
      .where(eq(driverApplications.driverId, userId));

    return { id: vehicle!.id, plateNumber, make, model, year, colour: colour ?? '', category };
  });
}

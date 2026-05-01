import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { db } from '../../config/db';
import { vehicles } from '../../db/schema/drivers';
import { driverApplications } from '../../db/schema/onboarding';

export async function routes(app: FastifyInstance) {
  app.get('/', async (req) => {
    const userId = req.user!.id;

    const rows = await db.query.vehicles.findMany({
      where: eq(vehicles.driverId, userId),
    });

    return rows.map((v) => ({
      id: v.id,
      plateNumber: v.plateNumber,
      make: v.make,
      model: v.model,
      year: v.year,
      colour: v.colour ?? '',
      category: v.category,
    }));
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
    const { plateNumber, make, model, year, colour, category = 'go' } = req.body;

    const [vehicle] = await db
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

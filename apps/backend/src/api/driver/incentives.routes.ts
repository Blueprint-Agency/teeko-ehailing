import type { FastifyInstance } from 'fastify';

export async function routes(app: FastifyInstance) {
  // driver · GET active campaigns + per-driver progress
  app.get('/__stub/incentives', async () => ({ stub: 'driver · GET active campaigns + per-driver progress' }));
}

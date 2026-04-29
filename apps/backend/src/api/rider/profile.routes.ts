import type { FastifyInstance } from 'fastify';

export async function routes(app: FastifyInstance) {
  // rider · /saved-places, /recent-places, /payment-methods
  app.get('/__stub/profile', async () => ({ stub: 'rider · /saved-places, /recent-places, /payment-methods' }));
}

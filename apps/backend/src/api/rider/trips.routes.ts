import type { FastifyInstance } from 'fastify';

export async function routes(app: FastifyInstance) {
  // rider · POST /trips, /cancel, /pin, /lost-item
  app.get('/__stub/trips', async () => ({ stub: 'rider · POST /trips, /cancel, /pin, /lost-item' }));
}

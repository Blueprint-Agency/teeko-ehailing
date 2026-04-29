import type { FastifyInstance } from 'fastify';

export async function routes(app: FastifyInstance) {
  // rider · /places, /directions
  app.get('/__stub/maps', async () => ({ stub: 'rider · /places, /directions' }));
}

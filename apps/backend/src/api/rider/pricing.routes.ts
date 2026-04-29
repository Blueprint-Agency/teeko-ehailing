import type { FastifyInstance } from 'fastify';

export async function routes(app: FastifyInstance) {
  // rider · POST /quotes
  app.get('/__stub/pricing', async () => ({ stub: 'rider · POST /quotes' }));
}

import type { FastifyInstance } from 'fastify';

export async function routes(app: FastifyInstance) {
  // admin · ops dashboard
  app.get('/__stub/metrics', async () => ({ stub: 'admin · ops dashboard' }));
}

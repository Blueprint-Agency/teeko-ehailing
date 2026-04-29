import type { FastifyInstance } from 'fastify';

export async function routes(app: FastifyInstance) {
  // driver · /ratings
  app.get('/__stub/ratings', async () => ({ stub: 'driver · /ratings' }));
}

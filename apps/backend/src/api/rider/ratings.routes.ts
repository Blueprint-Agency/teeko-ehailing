import type { FastifyInstance } from 'fastify';

export async function routes(app: FastifyInstance) {
  // rider · /ratings
  app.get('/__stub/ratings', async () => ({ stub: 'rider · /ratings' }));
}

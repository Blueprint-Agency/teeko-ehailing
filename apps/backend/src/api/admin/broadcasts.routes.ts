import type { FastifyInstance } from 'fastify';

export async function routes(app: FastifyInstance) {
  // admin · compose, schedule, segment
  app.get('/__stub/broadcasts', async () => ({ stub: 'admin · compose, schedule, segment' }));
}

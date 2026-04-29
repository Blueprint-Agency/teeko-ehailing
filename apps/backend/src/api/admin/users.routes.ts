import type { FastifyInstance } from 'fastify';

export async function routes(app: FastifyInstance) {
  // admin · search, suspend, strikes
  app.get('/__stub/users', async () => ({ stub: 'admin · search, suspend, strikes' }));
}

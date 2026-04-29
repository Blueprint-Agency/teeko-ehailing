import type { FastifyInstance } from 'fastify';

export async function routes(app: FastifyInstance) {
  // admin · approve, doc review, EVP submit
  app.get('/__stub/drivers', async () => ({ stub: 'admin · approve, doc review, EVP submit' }));
}

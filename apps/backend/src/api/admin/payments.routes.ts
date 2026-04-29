import type { FastifyInstance } from 'fastify';

export async function routes(app: FastifyInstance) {
  // admin · refunds
  app.get('/__stub/payments', async () => ({ stub: 'admin · refunds' }));
}

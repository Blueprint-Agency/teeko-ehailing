import type { FastifyInstance } from 'fastify';

export async function routes(app: FastifyInstance) {
  // admin · weekly close, override
  app.get('/__stub/payouts', async () => ({ stub: 'admin · weekly close, override' }));
}

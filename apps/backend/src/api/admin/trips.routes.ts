import type { FastifyInstance } from 'fastify';

export async function routes(app: FastifyInstance) {
  // admin · force-cancel, audit
  app.get('/__stub/trips', async () => ({ stub: 'admin · force-cancel, audit' }));
}

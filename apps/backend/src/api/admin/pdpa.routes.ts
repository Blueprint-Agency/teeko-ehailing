import type { FastifyInstance } from 'fastify';

export async function routes(app: FastifyInstance) {
  // admin · SAR export, erasure, retention
  app.get('/__stub/pdpa', async () => ({ stub: 'admin · SAR export, erasure, retention' }));
}

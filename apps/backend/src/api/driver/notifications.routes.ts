import type { FastifyInstance } from 'fastify';

export async function routes(app: FastifyInstance) {
  // driver · inbox (EVP, doc-expiry, suspension)
  app.get('/__stub/notifications', async () => ({ stub: 'driver · inbox (EVP, doc-expiry, suspension)' }));
}

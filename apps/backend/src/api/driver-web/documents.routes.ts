import type { FastifyInstance } from 'fastify';

export async function routes(app: FastifyInstance) {
  // driver-web · multipart upload · /:id/resubmit
  app.get('/__stub/documents', async () => ({ stub: 'driver-web · multipart upload · /:id/resubmit' }));
}
